# Entity Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every distinct thing a user mentions become exactly one node that enriches over time — by realigning the completion gate, collapsing duplicates via a model-driven `refines` pointer, and persisting all pending entities on session close.

**Architecture:** Three coordinated changes to the extraction→vault pipeline (`entityTypes.ts` tier-1 params, `synthesize.ts` extraction contract + prompt, `extract.ts` routing + close), wired through `route.ts`, plus a committed eval harness. No DB schema change; no destructive operations.

**Tech Stack:** Next.js 16 / TypeScript, Supabase (Postgres), Gemini 2.5 Flash (extraction, strict structured output; Cerebras gpt-oss-120b fallback). Tests are inline `assert` self-checks run with `npx tsx <file>` (project convention — no jest/vitest), plus `tsc --noEmit`, `pnpm build`, and a golden-transcript eval.

## Global Constraints

- No database schema migration and no destructive DB operations (no reset/delete/wipe).
- `tsc --noEmit` and `pnpm build` must be clean after every task (run from `apps/web`).
- Extraction attribute names are exact Title-Case: `Category`, `Name`, `When`, `Brand`, `Color`, `Material`, `Size`, `Location`, `Frequency`, `Relationship`, `Where`. Never substitute (not "Timeframe" for `When`, not "Destination" for `Where`).
- The extraction model stays isolated to the fetch blocks in `synthesize.ts` (swappable provider) — do not couple extraction logic to a specific provider.
- Self-check idiom (match `lib/ai/relations.ts`): a block guarded by `if (process.argv[1] && process.argv[1].endsWith("<file>.ts"))` with an inline `assert` that `process.exit(1)` on failure and logs `<file>.ts self-check OK` on success.
- All commands run from `C:\Users\mende\desktop\hype\apps\web`.

---

### Task 1: Realign tier-1 completion params

**Files:**
- Modify: `apps/web/lib/ai/entityTypes.ts`

**Interfaces:**
- Consumes: existing `getTier1Missing(entityType, content_md)` (unchanged signature).
- Produces: new `TIER_PARAMS` tier-1 sets — `item:["Category"]`, `place:["Name"]`, `event:["When"]`, `person:["Name","Relationship"]`, `brand:["Category"]`.

- [ ] **Step 1: Write the failing self-check**

Append to the bottom of `apps/web/lib/ai/entityTypes.ts`:

```ts
// ponytail: one runnable check — `npx tsx lib/ai/entityTypes.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("entityTypes.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  assert(getTier1Missing("item", "- **Category**: pants").length === 0, "item completes on Category alone")
  assert(getTier1Missing("item", "- **Color**: blue").length === 1, "item without Category is incomplete")
  assert(getTier1Missing("event", "- **When**: next week").length === 0, "event completes on When")
  assert(getTier1Missing("brand", "- **Category**: coffee shop").length === 0, "brand completes on Category")
  assert(getTier1Missing("place", "- **Name**: Galeria Rzeszow").length === 0, "named place completes on Name")
  assert(getTier1Missing("place", "- **Frequency**: weekly").length === 1, "unnamed place is incomplete")
  console.log("entityTypes.ts self-check OK")
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx tsx lib/ai/entityTypes.ts`
Expected: `FAIL: item completes on Category alone` (current `item` tier-1 is `["Brand","Category"]`, so `Category` alone still reports `Brand` missing).

- [ ] **Step 3: Replace TIER_PARAMS**

Replace the `TIER_PARAMS` object (lines 4-10) with:

```ts
export const TIER_PARAMS: Record<EntityType, { tier1: string[]; tier2: string[]; tier3: string[] }> = {
  item:   { tier1: ["Category"],             tier2: ["Brand", "Color", "Size", "Price Range"], tier3: ["Material", "Model", "Where Purchased"] },
  place:  { tier1: ["Name"],                 tier2: ["Location", "Frequency", "What For", "Who With"], tier3: ["Specific Items", "Price Range"] },
  person: { tier1: ["Name", "Relationship"], tier2: ["Context", "How Long Known"], tier3: ["Age", "Shared Interests"] },
  event:  { tier1: ["When"],                 tier2: ["Where", "Who With"], tier3: ["Frequency", "How They Felt"] },
  brand:  { tier1: ["Category"],             tier2: ["Sentiment"], tier3: ["Specific Products"] },
}
```

- [ ] **Step 4: Run the self-check and tsc**

Run: `npx tsx lib/ai/entityTypes.ts`
Expected: `entityTypes.ts self-check OK`

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai/entityTypes.ts
git commit -m "feat(extract): realign tier-1 params to realistic per-type minimums"
```

---

### Task 2: Extraction contract — `refines` pointer, required-attribute vocabulary, tracking context

**Files:**
- Modify: `apps/web/lib/ai/synthesize.ts`
- Modify: `apps/web/lib/ai/extract.ts` (add `refines?: string` to `RawEntity` only)
- Modify: `apps/web/scripts/model-shootout.ts` (rename the `agendaContext` import + call — it's the only other consumer)

**Interfaces:**
- Consumes: `Agenda` (from `./checklists`), `RawEntity`/`Attr` (from `./extract`).
- Produces:
  - `RawEntity` gains `refines?: string`.
  - `buildTrackingContext(agenda: Agenda, knownNotes?: Array<{ title: string; entity_type: string | null }>): string` (renamed from `agendaContext`, extra param, default `[]`).
  - `synthesize(messages, agenda, knownNotes?: Array<{ title: string; entity_type: string | null }>): Promise<ExtractionResult>` — third param, default `[]`.
  - Each returned entity carries `refines?: string` (trimmed; `undefined` when blank).

- [ ] **Step 1: Add `refines` to the RawEntity type**

In `apps/web/lib/ai/extract.ts`, add one field to the `RawEntity` type (after `relations?`):

```ts
  relations?: { to: string; label: string }[]
  refines?: string
}
```

- [ ] **Step 2: Add `refines` to the extraction SCHEMA**

In `apps/web/lib/ai/synthesize.ts`, inside `SCHEMA.properties.entities.items.properties`, add a `refines` property (after `relations`):

```ts
          refines: {
            type: "string",
            description: 'Exact title of an already-tracked/in-graph entity that THIS entity is the same as, or a more specific description of (e.g. tracked "Pants" and now "blue linen pants"). "" if this is a genuinely new thing.',
          },
```

And add `"refines"` to that entity's `required` array:

```ts
        required: ["title", "entity_type", "tags", "brand", "intent", "intent_confidence", "intent_utterance", "scheduled_for", "description", "attributes", "relations", "refines"],
```

- [ ] **Step 3: Add the required-attribute + refines rules to the prompt**

In `apps/web/lib/ai/synthesize.ts`, in the `SYSTEM` string, insert these two sections immediately before the `## relations` section:

```
## required attributes — always emit these (this is how the graph knows an entity is complete enough to keep)
- item → **Category** (belt, shoes, laptop). Emit **Brand** only when a store is named.
- place → **Name** when the place has a proper name (Galeria Rzeszow, Monmouth Coffee). Omit Name for a generic unnamed place ("the mall") — it stays a thread until named.
- person → **Name** (if known) and **Relationship** (friend, sister, coworker).
- event → **When** — a date or relative time ("next week", "in August"). The title says WHAT the event is; When says when.
- brand → **Category** (coffee shop, clothing store). The brand's name is the title.
Use these exact Title-Case attribute names. Never substitute (not "Timeframe" for When, not "Destination" for Where).

## refines — collapse mentions of the same thing
You are given the entities already tracked or in the graph (see "Currently tracking" and "Already tracked or in the graph"). If something mentioned this window is the SAME entity as one of those, or a more specific description of it (tracked "Pants" and now "blue linen pants"; tracked "Running shoes" and now "my Nikes"), do NOT create a new entity — set refines to that entity's EXACT title and put the new details in this entity's attributes. Only set refines to a title from that list; leave it "" for a genuinely new thing.
```

- [ ] **Step 4: Rename `agendaContext` → `buildTrackingContext` and list the full tracked set**

In `apps/web/lib/ai/synthesize.ts`, replace the `agendaContext` function (lines ~143-147) with:

```ts
export function buildTrackingContext(
  agenda: Agenda,
  knownNotes: Array<{ title: string; entity_type: string | null }> = []
): string {
  const lines: string[] = []
  if (agenda.current) {
    const known = agenda.current.attributes.map((a) => a.title).join(", ") || "none"
    lines.push(`Currently tracking: "${agenda.current.title}" (${agenda.current.entity_type}). Already have these attributes: ${known}.`)
  } else {
    lines.push("Currently tracking: (nothing yet)")
  }
  // Everything else already known — the model must refine these, not re-create them.
  const seen = new Set<string>(agenda.current ? [agenda.current.title.toLowerCase()] : [])
  const others: string[] = []
  for (const p of agenda.pending) {
    const k = p.title.toLowerCase()
    if (!seen.has(k)) { seen.add(k); others.push(`${p.title} (${p.entity_type})`) }
  }
  for (const n of knownNotes) {
    const k = n.title.toLowerCase()
    if (!seen.has(k)) { seen.add(k); others.push(`${n.title}${n.entity_type ? ` (${n.entity_type})` : ""}`) }
  }
  if (others.length) {
    lines.push(`Already tracked or in the graph (do NOT re-create these — set refines to the exact title if a mention refers to one): ${others.join(", ")}.`)
  }
  return lines.join("\n")
}
```

Then update the only other consumer, `apps/web/scripts/model-shootout.ts`: change the import on line ~24 from `agendaContext,` to `buildTrackingContext,` and the call on line ~282 from `agendaContext(AGENDA)` to `buildTrackingContext(AGENDA)` (the new second param is optional, so the call is otherwise unchanged).

- [ ] **Step 5: Thread `knownNotes` and `refines` through `synthesize`**

In `apps/web/lib/ai/synthesize.ts`:

Add `refines: string` to the `ParsedEntity` type (after `relations`):

```ts
  relations: { to: string; label: string }[]
  refines: string
}
```

Change the `synthesize` signature and `userContent`:

```ts
export async function synthesize(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  agenda: Agenda,
  knownNotes: Array<{ title: string; entity_type: string | null }> = []
): Promise<ExtractionResult> {
  const empty: ExtractionResult = { attributes: [], entities: [] }
  if (!messages.length) return empty

  const userContent = `${buildTrackingContext(agenda, knownNotes)}\n\nConversation slice:\n${buildWindow(messages)}`
```

In the entities normalization `.map((e) => {...})`, add `refines` to the returned object (after `relations`):

```ts
      relations: (e.relations ?? []).filter((r) => r?.to?.trim() && r?.label?.trim()).map((r) => ({ to: r.to.trim(), label: r.label.trim() })),
      refines: e.refines?.trim() ? e.refines.trim() : undefined,
```

- [ ] **Step 6: Add a self-check for `buildTrackingContext`**

Append to the bottom of `apps/web/lib/ai/synthesize.ts`:

```ts
// ponytail: one runnable check — `npx tsx lib/ai/synthesize.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("synthesize.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  const agenda = {
    current: { title: "Pants", entity_type: "item", attributes: [{ title: "Category", value: "pants" }] },
    pending: [{ title: "Starbucks", entity_type: "brand" }],
  } as unknown as Agenda
  const ctx = buildTrackingContext(agenda, [{ title: "Galeria Rzeszow", entity_type: "place" }])
  assert(ctx.includes('Currently tracking: "Pants"'), "shows current entity")
  assert(ctx.includes("Starbucks (brand)"), "lists pending entities")
  assert(ctx.includes("Galeria Rzeszow (place)"), "lists known vault notes")
  assert(!ctx.split("Already tracked")[1]?.includes("Pants"), "does not duplicate current into the known list")
  console.log("synthesize.ts self-check OK")
}
```

- [ ] **Step 7: Run self-check + tsc**

Run: `npx tsx lib/ai/synthesize.ts`
Expected: `synthesize.ts self-check OK`

Run: `npx tsc --noEmit`
Expected: clean. (`route.ts` still calls `synthesize(messages, agenda)` — valid because `knownNotes` defaults to `[]`; it gets wired in Task 4.)

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/ai/synthesize.ts apps/web/lib/ai/extract.ts
git commit -m "feat(extract): add refines pointer, required-attribute vocabulary, full tracking context"
```

---

### Task 3: Route extracted entities by `refines || title`

**Files:**
- Modify: `apps/web/lib/ai/extract.ts` (routing loop + relation source; add `mergeEntity` helper)

**Interfaces:**
- Consumes: `RawEntity.refines` (from Task 2), existing `mergeAttrs`, `nodeToAgendaItem`, `makeAgendaItem`.
- Produces: entities whose `refines` (or, absent that, exact title) resolves to a current/pending/written entity are merged into it instead of creating a duplicate node; intent on a refining entity propagates to its target.

- [ ] **Step 1: Add a `mergeEntity` helper**

In `apps/web/lib/ai/extract.ts`, add this helper next to `mergeAttrs` (after `mergeAttrs`, ~line 81):

```ts
// Merge an incoming extracted entity into an existing tracked agenda item: fold its
// attributes (via mergeAttrs) and carry a forward-looking intent it may bring ("I need
// blue linen pants" refining the tracked "Pants"). The target keeps its canonical title.
function mergeEntity(target: AgendaItem, entity: RawEntity) {
  mergeAttrs(target, entity.attributes)
  if (entity.intent && !target.intent) {
    target.intent = true
    target.intent_utterance = entity.intent_utterance ?? ""
    target.intent_confidence = entity.intent_confidence ?? 0
  }
}
```

- [ ] **Step 2: Route on `refines || title` and use `mergeEntity`**

In `apps/web/lib/ai/extract.ts`, in the entity-routing loop (currently lines ~314-335), change the key computation and swap the two active-set `mergeAttrs` calls for `mergeEntity`:

```ts
  for (const entity of extraction.entities) {
    // refines points at an existing entity this one refines; fall back to exact title.
    const key = (entity.refines?.trim() || entity.title).toLowerCase()

    if (agenda.current && agenda.current.title.toLowerCase() === key) {
      mergeEntity(agenda.current, entity)
      continue
    }
    const pendingMatch = agenda.pending.find((p) => p.title.toLowerCase() === key)
    if (pendingMatch) {
      mergeEntity(pendingMatch, entity)
      continue
    }
    // Already flushed → fold the late facts into the durable node now (re-open by title)
    const noteMatch = noteByTitle.get(key)
    if (noteMatch) {
      await writeEntityToVault(supabase, userId, conversationId, nodeToAgendaItem(noteMatch, entity))
      continue
    }
    const item = makeAgendaItem(entity)
    if (!agenda.current) agenda.current = item
    else agenda.pending.push(item)
  }
```

- [ ] **Step 3: Resolve relation source by `refines || title` too**

In `apps/web/lib/ai/extract.ts`, in the relationship post-pass, change the `rels` mapping (currently line ~342-344) so a refining entity's relations attach from its canonical target, not its discarded title:

```ts
  const rels = extraction.entities.flatMap((e) =>
    (e.relations ?? []).map((r) => ({ from: e.refines?.trim() || e.title, to: r.to, label: r.label }))
  )
```

- [ ] **Step 4: Verify tsc + build**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `pnpm build`
Expected: build succeeds (compiles `/api/chat`).

(No standalone self-check: this is a key-computation change to DB-coupled routing with no committed DB test harness — behavior is covered by the Task 5 eval, which asserts the model emits `refines`, and by the final live replay.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai/extract.ts
git commit -m "feat(extract): route entities by refines||title so refinements merge instead of duplicating"
```

---

### Task 4: Persist all pending on close + wire `route.ts`

**Files:**
- Modify: `apps/web/lib/ai/extract.ts` (`closeSession`)
- Modify: `apps/web/app/api/chat/route.ts` (pass `knownNotes`; simplify opening carryover; remove `isNewSession` + "Carried over" block)

**Interfaces:**
- Consumes: `writeEntityToVault`, `getTier1Missing`, `attrsToContentMd` (all in `extract.ts`); `synthesize(messages, agenda, knownNotes)` (Task 2).
- Produces: `closeSession(conversationId, userId): Promise<void>` (was `Promise<AgendaItem[]>`) — writes every pending + current entity to the vault and empties the agenda.

- [ ] **Step 1: Rewrite `closeSession` to persist everything and return void**

In `apps/web/lib/ai/extract.ts`, replace the `closeSession` function (currently lines ~384-398) with:

```ts
// Session close (farewell or 2h timeout). Persist EVERY pending + current entity to the
// vault now (incomplete flag when tier-1 unmet — writeEntityToVault sets it; recordIntent
// fires for intent-bearing ones). Nothing mentioned is lost: complete ones become known
// facts, incomplete ones resurface next session via "Unfinished from last session". The
// agenda is emptied; the next conversation starts fresh. Idempotent: upserts are by path.
export async function closeSession(conversationId: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: conv } = await supabase.from("conversations").select("agenda").eq("id", conversationId).single()
  const agenda: Agenda = (conv?.agenda as Agenda) ?? { current: null, pending: [] }

  const queue = [...(agenda.current ? [agenda.current] : []), ...agenda.pending]
  for (const item of queue) {
    // Recompute completeness from the item's current attributes before writing.
    const tier1Missing = getTier1Missing(item.entity_type, attrsToContentMd(item.attributes))
    item.tier1_complete = tier1Missing.length === 0
    await writeEntityToVault(supabase, userId, conversationId, item)
  }

  await supabase.from("conversations").update({ agenda: { current: null, pending: [] } }).eq("id", conversationId)
}
```

- [ ] **Step 2: Pass known notes into `synthesize`**

In `apps/web/app/api/chat/route.ts`, in the `after()` extraction block (line ~469), pass the already-fetched `vaultNotes`:

```ts
      after(() =>
        synthesize(messages, agenda, vaultNotes ?? [])
          .then((extraction) => extractFacts(conversationId, user.id, extraction))
          .then(() => (isFarewell ? closeSession(conversationId, user.id).then(() => {}) : undefined))
          .catch((err) => console.error("[chat] extraction failed:", err))
      )
```

- [ ] **Step 3: Simplify the opening carryover and drop dead code**

In `apps/web/app/api/chat/route.ts`:

Remove the `isNewSession` declaration (line ~280): delete `let isNewSession = false`.

Replace the `else if (recent) { ... }` branch (lines ~298-316) with:

```ts
  } else if (recent) {
    // New session. A stale-active conversation is closed (banks intent, persists pending);
    // a farewell-completed one was already closed last turn. Either way the next
    // conversation starts fresh — incomplete nodes resurface via "Unfinished from last
    // session", complete ones via "What you already know".
    if (recent.status === "active") {
      await closeSession(recent.id, user.id)
      await supabase.from("conversations").update({ status: "completed" }).eq("id", recent.id)
    }
    const { data: created } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id")
      .single()
    conversationId = created!.id
  } else {
```

Remove the "Carried over from last session" line from the `systemPrompt` array (line ~398). Delete this entire array element:

```ts
        isNewSession && agenda.pending.length ? `## Carried over from last session — these were queued but not reached:\n${agenda.pending.map((p) => `- ${p.title} (${p.entity_type})`).join("\n")}` : "",
```

- [ ] **Step 4: Verify tsc + build**

Run: `npx tsc --noEmit`
Expected: clean (no remaining references to `isNewSession`; `closeSession` callers already discard its result).

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/ai/extract.ts apps/web/app/api/chat/route.ts
git commit -m "feat(extract): persist all pending on close; wire tracking context into extraction"
```

---

### Task 5: Golden-transcript extraction eval harness

**Files:**
- Create: `apps/web/scripts/extract-eval.ts`

**Interfaces:**
- Consumes: `synthesize` (from `../lib/ai/synthesize`), `GEMINI_API_KEY` from `.env.local`.
- Produces: a runnable smoke test — `npx tsx scripts/extract-eval.ts` — asserting the model emits the required vocabulary (`Category`, `When`) and uses `refines` to collapse a refinement.

- [ ] **Step 1: Write the eval harness**

Create `apps/web/scripts/extract-eval.ts`:

```ts
// Golden-transcript smoke test for extraction quality. Runs real conversation slices
// through synthesize() and asserts the model emits the required vocabulary and collapses
// refinements. It calls the live model (temperature 0) — a smoke test, not a hard gate.
// Run from apps/web:  npx tsx scripts/extract-eval.ts
import { readFileSync } from "fs"
import { synthesize } from "../lib/ai/synthesize"
import type { Agenda } from "../lib/ai/checklists"

// Load .env.local without a dependency (Node --env-file support varies).
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim()
}

let failed = 0
const assert = (c: boolean, m: string) => { console.log(`${c ? "ok  " : "FAIL"}: ${m}`); if (!c) failed++ }
const hasAttr = (attrs: { title: string }[], name: string) =>
  attrs.some((a) => a.title.toLowerCase() === name.toLowerCase())

async function main() {
  // 1. Item → Category emitted (belt bought, no store).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "What did you pick up?" }, { role: "user", content: "I bought a belt today" }],
      { current: null, pending: [] } as Agenda
    )
    const belt = ext.entities.find((e) => e.entity_type === "item")
    assert(!!belt && hasAttr(belt.attributes, "Category"), "item 'belt' carries a Category attribute")
  }

  // 2. Event → When emitted (not Timeframe/Destination).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "Anything coming up?" }, { role: "user", content: "I'm going to a concert next week" }],
      { current: null, pending: [] } as Agenda
    )
    const evt = ext.entities.find((e) => e.entity_type === "event")
    assert(!!evt && (hasAttr(evt.attributes, "When") || !!evt.scheduled_for), "event carries When (or scheduled_for)")
  }

  // 3. Refinement collapses: tracking "Pants", user adds material → no new bare item,
  //    or a refines pointer back to Pants.
  {
    const agenda = {
      current: { title: "Pants", entity_type: "item", attributes: [{ title: "Category", value: "pants" }], brand: null, intent: false, intent_utterance: "", intent_confidence: 0, scheduled_for: null, description: "", missing: [], turns: 1, weight: 2, tier1_complete: true, tags: ["Shopping"] },
      pending: [],
    } as unknown as Agenda
    const ext = await synthesize(
      [{ role: "assistant", content: "Nice — what are they like?" }, { role: "user", content: "They're blue and made of linen" }],
      agenda,
      [{ title: "Pants", entity_type: "item" }]
    )
    const newBarePants = ext.entities.filter(
      (e) => e.entity_type === "item" && (e.refines ?? "").toLowerCase() !== "pants"
    )
    assert(newBarePants.length === 0, "refinement of tracked 'Pants' does not spawn a new unlinked item")
  }

  console.log(failed === 0 ? "\nextract-eval: ALL OK" : `\nextract-eval: ${failed} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the eval against the live model**

Run: `npx tsx scripts/extract-eval.ts`
Expected: `extract-eval: ALL OK` (requires `GEMINI_API_KEY` in `.env.local`; the model runs at temperature 0, so results are stable turn-to-turn).

If an assert fails, the fix is in the `synthesize.ts` prompt (Task 2 sections), not the harness — the harness is the regression signal.

- [ ] **Step 3: Commit**

```bash
git add apps/web/scripts/extract-eval.ts
git commit -m "test(extract): golden-transcript extraction eval harness"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` clean; `pnpm build` clean.
- [ ] `npx tsx lib/ai/entityTypes.ts` and `npx tsx lib/ai/synthesize.ts` self-checks OK.
- [ ] `npx tsx scripts/extract-eval.ts` → ALL OK.
- [ ] Live replay (user-run `/hypereset`, then a mall/pants/friend conversation): one `Pants` node carrying Category+Color+Material; one named place; satellites persisted; relation edges present. Fine-tune the `synthesize.ts` prompt from the real transcript.

## Future work (noted, not in scope)

- pgvector semantic dedup for synonym cases ("sneakers"/"trainers"/"running shoes") if `refines` accuracy plateaus.
- If `CHECKLIST_PROMPT` (`checklists.ts`) hardcodes the old tier params in prose, refresh it — display text only, not a gate.

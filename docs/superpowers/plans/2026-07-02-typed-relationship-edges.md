# Typed Relationship Edges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the knowledge graph real depth by connecting entities to each other with model-emitted relationship edges, instead of a flat `You`-centered star wired together by hollow shared-tag edges.

**Architecture:** The extraction pass emits, per entity, a list of `{ to, label }` relations to other entities in the same conversation window. `extractFacts` runs a best-effort post-pass that resolves those titles to note ids and upserts `link_type:'relation'` edges. The client-side self-spine in `GraphCanvas` generalizes from "link You to every non-brand-child" to "link You only to roots" (nodes with no incoming `brand`/`relation` edge), so related entities nest instead of fanning off `You`. The old `linkByTag` edges are removed.

**Tech Stack:** Next.js 16 / TypeScript, Supabase Postgres (`vault_notes`, `vault_links`), Gemini 2.5 Flash (extraction, strict JSON schema), D3 force simulation.

## Global Constraints

- Extraction model call lives in one fetch block in `lib/ai/synthesize.ts`; keep it swappable. Gemini schema is the OpenAPI subset produced by `toGeminiSchema`; the Cerebras fallback uses the raw `SCHEMA` (strict `json_schema`). Both must stay schema-valid.
- Relation `label` ≤ 3 words; `to` must be the exact title of another entity in the window.
- No new npm dependencies.
- Admin client (`lib/supabase/admin.ts`) only in `app/api/` or server-only `lib/` modules — never client-side.
- Verification norm (no committed test runner): `npx tsc --noEmit` + `pnpm build` clean; `assert`-based self-check for pure logic; live replay for model/DB behavior. Run commands from `apps/web`.
- `relation` edges are directional: `source_note_id` = the entity that owns the relation, `target_note_id` = the `to` entity.

---

### Task 1: Extraction emits relations

**Files:**
- Modify: `apps/web/lib/ai/synthesize.ts` (SCHEMA entity props + required; SYSTEM prompt; `ParsedEntity` type; `synthesize()` mapping)
- Modify: `apps/web/lib/ai/extract.ts:38-50` (`RawEntity` type gains `relations`)

**Interfaces:**
- Produces: `RawEntity.relations?: { to: string; label: string }[]` (defaulted to `[]` by `synthesize()`), consumed by Task 2.

- [ ] **Step 1: Add `relations` to `RawEntity`**

In `apps/web/lib/ai/extract.ts`, extend the `RawEntity` type (currently ends at `attributes?: Attr[]`):

```ts
export type RawEntity = {
  title: string
  topic: string
  brand: string | null
  entity_type: "item" | "brand" | "place" | "event" | "person"
  tags: string[]
  intent: boolean
  intent_confidence?: number
  intent_utterance?: string
  scheduled_for: string | null
  description: string
  attributes?: Attr[]
  relations?: { to: string; label: string }[]
}
```

- [ ] **Step 2: Add `relations` to the extraction SCHEMA**

In `apps/web/lib/ai/synthesize.ts`, inside `SCHEMA.properties.entities.items.properties`, add a `relations` property (place it after `attributes`):

```ts
        relations: {
          type: "array",
          description: "Links from THIS entity to OTHER entities in this window that it genuinely relates to. Empty array if none.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              to: { type: "string", description: "exact title of another entity in this window" },
              label: { type: "string", description: "short verb phrase for the relationship, <=3 words: at, with, hosts, for, lives in" },
            },
            required: ["to", "label"],
          },
        },
```

Then add `"relations"` to that entity object's `required` array (strict mode requires every listed property to be in `required`):

```ts
        required: ["title", "entity_type", "tags", "brand", "intent", "intent_confidence", "intent_utterance", "scheduled_for", "description", "attributes", "relations"],
```

- [ ] **Step 3: Add a relations rule to the extraction SYSTEM prompt**

In `apps/web/lib/ai/synthesize.ts`, in the `SYSTEM` string, add this section immediately before the final `Return only the structured JSON...` line:

```
## relations
For each entity, connect it to OTHER entities in this window that it genuinely relates to. Each relation is { to: <exact title of another entity>, label: <verb phrase, <=3 words> }. Natural patterns:
- an event AT a place ("at"); an event WITH a person ("with")
- an item kept at or bought for a place ("for" / "kept at")
- a person who lives in a place ("lives in")
Reuse the exact title of an entity you are also returning in this window — never invent a target that isn't one of the entities. Emit an empty array when nothing genuinely connects. Do not relate an entity to itself.
```

- [ ] **Step 4: Thread `relations` through the `ParsedEntity` type and `synthesize()` mapping**

In `apps/web/lib/ai/synthesize.ts`, add to the `ParsedEntity` type (after `attributes: Attr[]`):

```ts
  relations: { to: string; label: string }[]
```

In `synthesize()`, in the `.map((e) => { ... })` that builds `entities`, add to the returned object (after `attributes: e.attributes ?? []`):

```ts
      relations: (e.relations ?? []).filter((r) => r?.to?.trim() && r?.label?.trim()).map((r) => ({ to: r.to.trim(), label: r.label.trim() })),
```

- [ ] **Step 5: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Live extraction replay — confirm relations emitted**

Create `scratch/relations-check.ts` (gitignored scratch is fine; or place under the session scratchpad) with:

```ts
import { readFileSync } from "node:fs"
const env = readFileSync("apps/web/.env.local", "utf8")
for (const line of env.split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "") }
const { synthesize } = await import("./apps/web/lib/ai/synthesize.ts")
const messages = [
  { role: "user", content: "next week i might travel to Germany for a couple of days" },
  { role: "assistant", content: "Oh nice, what's taking you there?" },
  { role: "user", content: "visiting a friend, she lives in Giessen and will host me" },
]
const out = await synthesize(messages as any, { current: null, pending: [] })
console.log(JSON.stringify(out.entities.map((e) => ({ title: e.title, relations: e.relations })), null, 2))
```

Run: `cd C:/Users/mende/desktop/hype && npx tsx scratch/relations-check.ts`
Expected: entities include a trip/event and a place (Giessen) and a person (friend), with relations such as `{ to: "Giessen", label: "at" }` and `{ to: <friend>, label: "with" }` or the friend `{ to: "Giessen", label: "lives in" }`. Exact titles/labels vary; what matters is non-empty, sensible relations referencing real entity titles.
(If `@/` imports fail under tsx, run with the app's tsconfig: `cd apps/web && npx tsx ../scratch/relations-check.ts` and adjust the import path to `./lib/ai/synthesize.ts`.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/ai/synthesize.ts apps/web/lib/ai/extract.ts
git commit -m "feat(extract): emit entity relations in extraction schema"
```

---

### Task 2: Resolve + write relation edges; remove tag edges

**Files:**
- Create: `apps/web/lib/ai/relations.ts` (pure resolver + inline `assert` self-check)
- Modify: `apps/web/lib/ai/extract.ts` (remove `linkByTag` fn + its 2 calls; add relationship post-pass in `extractFacts`; import resolver)
- Modify: `apps/web/types/database.ts:57` (`VaultLink.link_type` union gains `"relation"`)

**Interfaces:**
- Consumes: `RawEntity.relations` from Task 1.
- Produces: `resolveRelation(idByTitle, sourceTitle, targetTitle)` in `lib/ai/relations.ts`; `vault_links` rows with `link_type:'relation'` consumed by Task 3.

- [ ] **Step 1: Write the resolver with an assert self-check**

Create `apps/web/lib/ai/relations.ts`:

```ts
// Pure resolver for relationship edges. Kept dependency-free (no server imports) so it's
// trivially testable and reusable. Maps two entity titles to note ids via a case-insensitive
// title→id map; returns null when either end is missing or both ends are the same node.
export function resolveRelation(
  idByTitle: Map<string, string>,
  sourceTitle: string,
  targetTitle: string
): { source: string; target: string } | null {
  const source = idByTitle.get(sourceTitle.trim().toLowerCase())
  const target = idByTitle.get(targetTitle.trim().toLowerCase())
  if (!source || !target || source === target) return null
  return { source, target }
}

// ponytail: one runnable check — `npx tsx lib/ai/relations.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("relations.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  const map = new Map([["mall", "id-mall"], ["giessen", "id-g"]])
  assert(JSON.stringify(resolveRelation(map, "Mall", "Giessen")) === JSON.stringify({ source: "id-mall", target: "id-g" }), "resolves both ends case-insensitively")
  assert(resolveRelation(map, "Mall", "Nowhere") === null, "unresolved target → null")
  assert(resolveRelation(map, "Ghost", "Giessen") === null, "unresolved source → null")
  assert(resolveRelation(map, "Mall", "mall") === null, "self-link → null")
  console.log("relations.ts self-check OK")
}
```

- [ ] **Step 2: Run the self-check (verify it passes)**

Run: `cd apps/web && npx tsx lib/ai/relations.ts`
Expected: `relations.ts self-check OK`

- [ ] **Step 3: Extend `VaultLink.link_type` union**

In `apps/web/types/database.ts`, change the `VaultLink` row type (line ~57):

```ts
  link_type: "brand" | "tag" | "relation" | null
```

(`"tag"` stays in the union — harmless dead value; the data and code that create it are removed below.)

- [ ] **Step 4: Remove `linkByTag`**

In `apps/web/lib/ai/extract.ts`, delete the entire `linkByTag` inner function (the `async function linkByTag(entityNoteId: string) { ... }` block inside `writeEntityToVault`), and delete both `await linkByTag(entityNote.id)` call sites (one in the no-brand branch, one in the item-under-brand branch). Leave `recordIntent` calls intact.

- [ ] **Step 5: Import the resolver**

In `apps/web/lib/ai/extract.ts`, add near the top imports:

```ts
import { resolveRelation } from "./relations"
```

- [ ] **Step 6: Add the relationship post-pass in `extractFacts`**

In `apps/web/lib/ai/extract.ts`, in `extractFacts`, immediately before the final `await supabase.from("conversations").update({ agenda }).eq("id", conversationId)`, insert:

```ts
  // Relationship post-pass: connect entities to each other with model-emitted labels.
  // Best-effort — re-query all conversation nodes (now that this turn's writes have landed),
  // resolve source+target titles to ids, upsert 'relation' edges. Unresolved endpoints
  // (e.g. an entity still pending, not yet a node) are skipped; the model re-emits the
  // relation on later turns and the edge forms once both nodes exist (self-healing).
  const rels = extraction.entities.flatMap((e) =>
    (e.relations ?? []).map((r) => ({ from: e.title, to: r.to, label: r.label }))
  )
  if (rels.length) {
    const { data: allNotes } = await supabase
      .from("vault_notes")
      .select("id, title")
      .eq("user_id", userId)
      .eq("source", "conversation")
    const idByTitle = new Map<string, string>()
    for (const n of allNotes ?? []) idByTitle.set(n.title.toLowerCase(), n.id)

    const edges = []
    const seen = new Set<string>()
    for (const rel of rels) {
      const resolved = resolveRelation(idByTitle, rel.from, rel.to)
      if (!resolved) continue
      const key = `${resolved.source}->${resolved.target}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        user_id: userId,
        source_note_id: resolved.source,
        target_note_id: resolved.target,
        link_type: "relation" as const,
        anchor_text: rel.label.slice(0, 40),
      })
    }
    if (edges.length) {
      await supabase.from("vault_links").upsert(edges, { onConflict: "source_note_id,target_note_id", ignoreDuplicates: true })
    }
  }
```

- [ ] **Step 7: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no errors (no remaining references to `linkByTag`).

- [ ] **Step 8: One-time cleanup of existing tag edges**

Run this SQL once against the live project (via Supabase SQL editor or MCP `execute_sql`):

```sql
DELETE FROM vault_links WHERE link_type = 'tag';
```

Expected: existing shared-tag edges removed; no new ones form (creator deleted in Step 4).

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/ai/relations.ts apps/web/lib/ai/extract.ts apps/web/types/database.ts
git commit -m "feat(extract): write model-emitted relation edges; drop tag edges"
```

---

### Task 3: Graph nests via relation edges (rendering + self-spine)

**Files:**
- Modify: `apps/web/types/database.ts:110` (`GraphLink.link_type` union gains `"relation"`)
- Modify: `apps/web/components/graph/GraphCanvas.tsx` (self-spine generalization; `linkStyle`; relation edge tooltip)

**Interfaces:**
- Consumes: `vault_links` rows with `link_type:'relation'` from Task 2 (fetched in the existing `fetchGraph`, already selecting `link_type`).

- [ ] **Step 1: Extend `GraphLink.link_type` union**

In `apps/web/types/database.ts`, change the `GraphLink` type (line ~110):

```ts
  link_type: "brand" | "tag" | "relation" | "self" | null
```

- [ ] **Step 2: Generalize the self-spine to root-only**

In `apps/web/components/graph/GraphCanvas.tsx`, replace the `brandChildren` block (currently lines ~89-98) with:

```ts
      // A node is a "child" if something points at it via a brand or relation edge — it nests
      // under that parent and must NOT also get a You spoke, or the graph flattens back into a
      // star. You links only to ROOTS (no incoming brand/relation edge). This is what creates depth.
      const children = new Set(
        links
          .filter((l) => l.link_type === "brand" || l.link_type === "relation")
          .map((l) => (typeof l.target === "string" ? l.target : (l.target as GraphNode).id))
      )
      for (const n of nodes) {
        if (n.id === profile.id || children.has(n.id)) continue
        links.push({ id: `self-${n.id}`, source: profile.id, target: n.id, anchor_text: null, link_type: "self" })
      }
```

- [ ] **Step 3: Add the `relation` edge style (replace the dead `tag` style)**

In `apps/web/components/graph/GraphCanvas.tsx`, replace the `linkStyle` map (currently lines ~145-149) with:

```ts
    // self (You→root): soft white spine; brand: purple; relation (entity→entity): stronger neutral.
    const linkStyle: Record<string, { stroke: string; width: number }> = {
      self:     { stroke: "#ffffff33", width: 1.25 },
      brand:    { stroke: "#a78bfa45", width: 1.25 },
      relation: { stroke: "#ffffff4d", width: 1.25 },
    }
```

Then update the two `linkStyle[...] ?? linkStyle.tag` references (the `.attr("stroke", ...)` and `.attr("stroke-width", ...)` lines, ~154-155) to fall back to `relation`:

```ts
      .attr("stroke", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).stroke)
      .attr("stroke-width", (d) => (linkStyle[d.link_type ?? "relation"] ?? linkStyle.relation).width)
```

- [ ] **Step 4: Show the relation label as a native edge tooltip**

In `apps/web/components/graph/GraphCanvas.tsx`, immediately after the `const link = g.append("g")....attr("stroke-width", ...)` chain (i.e. right after the `link` selection is created, before `const node = ...`), add:

```ts
    // Relationship edges carry a label ("at", "with", …) — surface it on hover via a native
    // <title> child. (Node tooltips are the rich HTML ones; edges just get the plain label.)
    link.filter((d) => d.link_type === "relation" && !!d.anchor_text)
      .append("title")
      .text((d) => d.anchor_text ?? "")
```

- [ ] **Step 5: Type-check and build**

Run: `cd apps/web && npx tsc --noEmit && pnpm build`
Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/types/database.ts apps/web/components/graph/GraphCanvas.tsx
git commit -m "feat(graph): nest entities under relation edges; You links to roots only"
```

---

### Task 4: End-to-end live verification

**Files:** none (verification only).

- [ ] **Step 1: Reset to a clean vault**

In the app, run `/hypereset` (wipes vault, intents, messages, conversations; resets onboarding). Ensure the dev server is running (`cd apps/web && pnpm dev`) and Gemini is on the paid tier.

- [ ] **Step 2: Drive a multi-entity, related conversation**

Through the chat UI, run a conversation that produces related entities, e.g.: mention a trip to a city to visit a friend who lives there; mention a coffee at a named café at a mall. Complete enough turns that the entities flush to the vault.

- [ ] **Step 3: Confirm relation edges exist and resolve correctly**

Run (Supabase SQL editor or MCP `execute_sql`):

```sql
select s.title as source, l.link_type, l.anchor_text as label, t.title as target
from vault_links l
join vault_notes s on s.id = l.source_note_id
join vault_notes t on t.id = l.target_note_id
where s.user_id = (select user_id from conversations order by created_at desc limit 1)
order by l.link_type;
```

Expected: `link_type='relation'` rows connecting the right entities (e.g. trip → city, person → city), sensible `label`s, and **zero** `link_type='tag'` rows.

- [ ] **Step 4: Confirm the graph nests visually**

In the graph home screen, confirm target entities (e.g. the city, the friend) hang off their parent entity rather than each getting a spoke straight to `You`; only true roots connect to `You`. Hover a relation edge → the label shows.

- [ ] **Step 5: Update CLAUDE.md "What's been built" with a one-line entry** and commit.

```bash
git add CLAUDE.md
git commit -m "docs: note typed relationship edges shipped"
```

---

## Self-Review

**Spec coverage:**
- Extraction schema + prompt (`relations`) → Task 1. ✓
- Edge writing post-pass + resolver + remove `linkByTag` → Task 2. ✓
- Self-spine root-only generalization → Task 3 Step 2. ✓
- Relation rendering + label tooltip → Task 3 Steps 3-4. ✓
- Tag-edge data cleanup → Task 2 Step 8. ✓
- Non-goals (dedup) → untouched, as specified. ✓
- Testing (tsc/build, assert self-check, live replay) → Steps throughout + Task 4. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command shows expected output.

**Type consistency:** `resolveRelation(idByTitle: Map<string,string>, sourceTitle, targetTitle) → { source, target } | null` defined in Task 2 Step 1, called identically in Task 2 Step 6. `RawEntity.relations?: {to,label}[]` defined Task 1 Step 1, consumed Task 2 Step 6. `link_type:'relation'` added to `VaultLink` (Task 2 Step 3) and `GraphLink` (Task 3 Step 1) before use.

**Known limitation (from spec risks):** title-based resolution can miss when the model references a pre-rename title ("Mall") after the node was renamed ("Galeria Rzeszow"), or when an endpoint is still a pending (unwritten) entity — both are skipped and self-heal on later turns. Accepted, not a gap.

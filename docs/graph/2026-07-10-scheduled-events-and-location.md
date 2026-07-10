# Scheduled-event opener + current-location freshness

**Date:** 2026-07-10 · **Scope:** `apps/web` only · **Ethos:** ponytail — minimum viable change, one new column, no new deps.

## Why / current / desired

**Why.** Owner is in Giessen and returns home to Rzeszów on Sunday 2026-07-12. Two coupled gaps:

1. **Opener misses dated events.** `app/api/chat/route.ts:391` queries `.eq("scheduled_for", today)` — the event only surfaces if the user opens the app *on the exact day*. Open Monday instead of Sunday → the "back home" question never fires. And nothing marks an event as "already asked", so opening twice on the day would raise it twice.
2. **Relative dates don't extract.** `synthesize()` (`lib/ai/synthesize.ts:331-339`) never tells the model today's date, so "I'm going back home Sunday" can't resolve to `2026-07-12` — `scheduled_for` comes back empty and workstream 1 has nothing to fire on.
3. **Stale current city stays glued to You.** `GraphCanvas.tsx:204-209` links You→place for any title in `identityPlaces`, and `GraphWrapper.tsx:33` builds that array from `current_location` **raw** — no freshness check. Scout already solved this (`lib/scout/getScoutFind.ts:14`, `CURRENT_LOC_TTL_MS = 30 days`); the graph should reuse the same rule.

**Desired.** Any vault event with a `scheduled_for` on-or-before today (within 14 days back) is injected into the opener exactly once, phrased as a natural "did it happen?" question. Travel/return statements always extract with an ISO date. The You→Giessen link disappears once `current_location` is overwritten (to Rzeszów) or goes stale past 30 days; home city stays linked forever.

---

## A. Reliable scheduled-event opener (`app/api/chat/route.ts` + migration)

### A1. Migration — new column (do this FIRST, code depends on it)

`supabase/schema.sql` already has an idempotent ALTER block for this table (lines 155-160). Append right after line 160 (`idx_vault_notes_scheduled`):

```sql
-- Fire-once marker for the today-events opener: set when a dated event has been
-- surfaced to the interviewer, so each event is raised exactly once (missed days
-- still catch up on next open via the 14-day lookback in app/api/chat/route.ts).
ALTER TABLE public.vault_notes ADD COLUMN IF NOT EXISTS event_prompted_at TIMESTAMPTZ;
```

**Apply to the live DB too** — schema.sql is documentation, not migration state. Run via Supabase MCP `apply_migration` (project `aykjvvtolkaqvijfeewn`) with the same single `ALTER TABLE` statement, migration name `add_event_prompted_at`. RLS: the existing `"vault_notes: own" FOR ALL` policy (schema.sql:82) already covers the UPDATE below — no policy change, no admin client needed.

### A2. Query — fire-once window

`today` is computed at route.ts:328 as `const today = new Date().toISOString().split("T")[0]`. Stay consistent: compute the lookback bound the same way, just above the `Promise.all` (~line 379):

```ts
const LOOKBACK_DAYS = 14
const lookbackStart = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
```

Replace the `todayEvents` query (route.ts:387-392). Current:

```ts
    supabase
      .from("vault_notes")
      .select("title, topic, content_md, entity_type")
      .eq("user_id", user.id)
      .eq("scheduled_for", today)
      .is("archived_at", null),
```

New (adds `id` + `scheduled_for` to the select — `id` is needed for the fire-once UPDATE, `scheduled_for` for the wording):

```ts
    supabase
      .from("vault_notes")
      .select("id, title, topic, content_md, entity_type, scheduled_for")
      .eq("user_id", user.id)
      .lte("scheduled_for", today)
      .gte("scheduled_for", lookbackStart)
      .is("event_prompted_at", null)
      .is("archived_at", null),
```

The existing partial index `idx_vault_notes_scheduled (user_id, scheduled_for) WHERE scheduled_for IS NOT NULL` (schema.sql:159-160) serves this range query as-is. No new index.

### A3. Wording — a passed return/travel event reads as a welcome-back question

Replace `todayContext` (route.ts:459-461). Current:

```ts
  const todayContext = todayEvents?.length
    ? `\n\n## Scheduled for today:\n${todayEvents.map((e) => `- ${e.title}${e.topic ? ` (${e.topic})` : ""}`).join("\n")}\nOpen with one of these if it likely already happened, or wish them well if upcoming.`
    : ""
```

New — show each event's date (all surfaced events are today-or-past now, so "for today" is wrong), and steer travel events toward "did you make it?":

```ts
  const todayContext = todayEvents?.length
    ? `\n\n## Dated events due (scheduled for today or recently passed):\n${todayEvents.map((e) => `- ${e.title}${e.topic ? ` (${e.topic})` : ""} — scheduled ${e.scheduled_for}`).join("\n")}\nOpen by asking about one of these. It likely already happened — ask how it went. If it's a trip, return, or travel home, ask warmly whether they made it ("did you make it back to X?"). If it's scheduled for today and may still be upcoming, wish them well instead.`
    : ""
```

### A4. Fire-once — mark surfaced events after the reply persists

Mark AFTER the LLM reply succeeds and the turn is persisted, not at query time — if the chat call fails (route.ts:546-561 both-provider failure path returns early), the event must survive for the next open. Inside the `if (lastUserMsg && conversationId)` block (route.ts:589), next to the farewell update (~line 597), add:

```ts
    // Fire-once: these dated events were injected into this turn's prompt — mark them
    // so they're raised exactly once (RLS "vault_notes: own" covers this update).
    if (todayEvents?.length) {
      await supabase
        .from("vault_notes")
        .update({ event_prompted_at: new Date().toISOString() })
        .in("id", todayEvents.map((e) => e.id))
    }
```

Note: `todayEvents` is queried every turn, not only the opener — that's fine and intentional. The event gets injected into whichever turn happens first after its day arrives (opener or mid-conversation) and is marked on that same turn.

---

## B. Dates for travel always captured (`lib/ai/synthesize.ts` + eval case)

### B1. Thread today's date into the extraction call

`synthesize()` builds its user content at synthesize.ts:339. Current:

```ts
  const userContent = `${buildTrackingContext(agenda, knownNotes)}\n\nConversation slice:\n${buildWindow(messages)}`
```

New (the SYSTEM prompt is a module-level const, so the dynamic date goes into the per-call user content):

```ts
  const userContent = `Today's date: ${new Date().toISOString().split("T")[0]}\n\n${buildTrackingContext(agenda, knownNotes)}\n\nConversation slice:\n${buildWindow(messages)}`
```

### B2. Schema description — tell the model to resolve relative dates

synthesize.ts:97. Current:

```ts
          scheduled_for: { type: "string", description: "ISO date if this is a dated event, empty otherwise" },
```

New:

```ts
          scheduled_for: { type: "string", description: "ISO date (YYYY-MM-DD) if this is a dated event — resolve relative dates (Sunday, tomorrow, next week) against the Today's date given in the input. Empty otherwise." },
```

### B3. SYSTEM prompt — travel/return statements are always dated events

Two minimal edits to `SYSTEM` (synthesize.ts:129-212):

**(a)** The event bullet at line 152. Current:

```
- event: something that happens at a time
```

New:

```
- event: something that happens at a time. A planned trip, journey, or return home ("going back home Sunday", "flying to Berlin next week") is ALWAYS an event — emit it with scheduled_for resolved to an ISO date using Today's date.
```

**(b)** The `event → **When**` required-attribute line at 193. Current:

```
- event → **When** — a date or relative time ("next week", "in August"). The title says WHAT the event is; When says when.
```

New (append one sentence):

```
- event → **When** — a date or relative time ("next week", "in August"). The title says WHAT the event is; When says when. Whenever When is resolvable to a concrete date from Today's date, ALSO set scheduled_for to that ISO date — never leave scheduled_for empty for a dated event.
```

**(c)** — closes the D gap, see below — extend the `user_current_location` bullet (synthesize.ts:164). Current line ends `...not a settled home.` Append:

```
Also set it when the user CONFIRMS being in/back in a city the interviewer just named ("did you make it back to Rzeszów?" → "yes, got in last night" → user_current_location: "Rzeszów").
```

### B4. Runnable check — new extract-eval case

`scripts/extract-eval.ts` is the established live-model smoke test (numbered blocks, `assert(cond, msg)`, `failed` counter). Add case 4 after the refinement block (~line 72):

```ts
  // 4. Relative-date travel → event with ISO scheduled_for (workstream B, docs/graph/2026-07-10).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "Anything coming up?" }, { role: "user", content: "I'm heading back home to Rzeszów on Sunday" }],
      { current: null, pending: [] } as Agenda
    )
    const evt = ext.entities.find((e) => e.entity_type === "event")
    assert(!!evt, "travel/return statement yields an event entity")
    assert(!!evt?.scheduled_for && /^\d{4}-\d{2}-\d{2}$/.test(evt.scheduled_for), "return-home event carries an ISO scheduled_for")
    const todayISO = new Date().toISOString().split("T")[0]
    assert(!!evt?.scheduled_for && evt.scheduled_for >= todayISO, "resolved 'Sunday' is not in the past")
  }
```

---

## C. Stale current city floats off You (graph freshness gate)

### C1. Shared TTL — one client-safe module

Scout's `CURRENT_LOC_TTL_MS` lives in `lib/scout/getScoutFind.ts:14`, but that file starts with `import "server-only"` — the client-side `GraphWrapper` cannot import it. Extract to a tiny client-safe module so both share ONE constant. New file `lib/profile/currentLocation.ts`:

```ts
// Single source of truth for how long a current_location is trusted. Shared by
// scout (lib/scout/getScoutFind.ts, server) and the graph identity rule
// (components/graph/GraphWrapper.tsx, client) — keep them agreeing.
export const CURRENT_LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Fresh = has a timestamp within the TTL. No timestamp (legacy rows) = stale,
// matching scout's existing behavior (its currentFresh check requires current_location_at).
export const isCurrentLocationFresh = (at?: string | null): boolean =>
  !!at && Date.now() - new Date(at).getTime() < CURRENT_LOC_TTL_MS

// ponytail: one runnable check — `npx tsx lib/profile/currentLocation.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("currentLocation.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  assert(isCurrentLocationFresh(new Date().toISOString()), "just-now timestamp is fresh")
  assert(isCurrentLocationFresh(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()), "29 days old is fresh")
  assert(!isCurrentLocationFresh(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()), "31 days old is stale")
  assert(!isCurrentLocationFresh(undefined), "missing timestamp is stale")
  assert(!isCurrentLocationFresh(null), "null timestamp is stale")
  console.log("currentLocation.ts self-check OK")
}
```

Then in `lib/scout/getScoutFind.ts`: delete the local const at lines 12-14 and add `import { CURRENT_LOC_TTL_MS } from "@/lib/profile/currentLocation"` (keep its inline `currentFresh` logic at lines 62-65 untouched — same semantics, or optionally swap to `isCurrentLocationFresh(profile.current_location_at)` combined with the `.trim()` check).

### C2. Gate the identity list in GraphWrapper

Good news: `app/(app)/graph/page.tsx:16` selects the whole `base_profile` JSON and line 70 passes it through untouched — `current_location_at` (written by `extract.ts:296`) is ALREADY inside the object at runtime. Only the TS type and the gate need changing; **no page.tsx edit and no GraphCanvas edit** (GraphCanvas already links only what's in `identityPlaces` — gating at the source is the minimal cut).

`components/graph/GraphWrapper.tsx:14` — widen the Props type. Current:

```ts
  initialProfile: { display_name: string | null; base_profile: { age?: number; home_location?: string; current_location?: string } }
```

New:

```ts
  initialProfile: { display_name: string | null; base_profile: { age?: number; home_location?: string; current_location?: string; current_location_at?: string } }
```

`GraphWrapper.tsx:33` — gate the current-city entry. Current:

```tsx
        identityPlaces={[initialProfile.base_profile?.home_location, initialProfile.base_profile?.current_location].filter((s): s is string => !!s)}
```

New (add `import { isCurrentLocationFresh } from "@/lib/profile/currentLocation"` at the top):

```tsx
        // Home is always identity; current city only while its timestamp is fresh
        // (same 30-day TTL scout uses) — a stale current city floats off You.
        identityPlaces={[
          initialProfile.base_profile?.home_location,
          isCurrentLocationFresh(initialProfile.base_profile?.current_location_at)
            ? initialProfile.base_profile?.current_location
            : undefined,
        ].filter((s): s is string => !!s)}
```

Result: when `current_location` flips to Rzeszów (or the Giessen timestamp ages past 30 days), Giessen drops out of `identitySet` in GraphCanvas.tsx:204, the `self-` link is never synthesized, and the Giessen node floats as a normal place cluster. Home (Rzeszów) is linked unconditionally.

---

## D. The Sunday flip (verify — likely no code beyond B3c)

Trace, confirmed against source:

1. Sunday arrives → A2 surfaces the return event (fires even if opened Monday/Tuesday, once).
2. Interviewer asks "did you make it back to Rzeszów?" (A3 wording names the city — the event note's title/content carries it).
3. User replies. Extraction (`synthesize` → `extractFacts`) runs per route.ts:605-608. If the extractor emits `user_current_location`, `extract.ts:294-297` sets `base_profile.current_location = "Rzeszów"` + fresh `current_location_at`.
4. Next graph load: C's gate sees Rzeszów as current (fresh) AND home → identity either way; Giessen no longer matches → link gone.

**The gap:** the current `user_current_location` prompt rule (synthesize.ts:162-165) triggers on phrasings like "I'm in X" / "here in X". A bare "yes, I'm home!" reply — where only the *interviewer's* turn names the city — may extract nothing, leaving Giessen fresh (and You-linked) for up to 30 more days. **Fix is B3(c)** — the one-sentence confirmation rule — not prediction: nothing changes until the user actually confirms in chat. Do NOT auto-flip `current_location` when the event date passes; plans change — the interviewer asks, the answer drives the write. If the user never confirms, the 30-day TTL is the backstop.

---

## Ordering / dependencies

1. **A1 migration first** — live DB column via Supabase MCP `apply_migration`, plus the schema.sql line. A2/A4 code 500s (`column vault_notes.event_prompted_at does not exist`) without it.
2. **A2-A4** (route.ts) — one commit with A1's schema.sql edit.
3. **B** (synthesize.ts + eval case) — independent of A's code, but the whole feature only works end-to-end with both: B writes the dates A reads. Ship in the same session.
4. **C** (new `lib/profile/currentLocation.ts`, getScoutFind import swap, GraphWrapper) — fully independent of A/B.
5. **D** — verification pass at the end; only code is B3(c), already inside B.

## Guardrails & checks

| Check | Command (from `apps/web`) | What it proves |
|---|---|---|
| Freshness helper (new) | `npx tsx lib/profile/currentLocation.ts` | TTL boundary + missing-timestamp-is-stale (offline, no keys) |
| Extraction eval, incl. new case 4 | `NODE_OPTIONS="--conditions=react-server" pnpm dlx tsx scripts/extract-eval.ts` | "back home Sunday" → event with non-null, non-past ISO `scheduled_for` (live model, temp 0) |
| Existing synthesize self-check still green | `NODE_OPTIONS="--conditions=react-server" pnpm dlx tsx lib/ai/synthesize.ts` | prompt/schema edits didn't break tracking-context or junk-title logic |
| Build | `pnpm build` | types line up (GraphWrapper Props, todayEvents `.id`/`.scheduled_for`) |

Note: `synthesize.ts` imports `lib/admin/logEvent.ts` which is `import "server-only"` — hence the `--conditions=react-server` flag for anything importing it (the `npx tsx scripts/extract-eval.ts` line in that file's header comment predates the logEvent import; if plain `npx tsx` errors on server-only, use the flagged form and update the stale comment).

Manual acceptance (owner, this weekend): seed/confirm the "back home" event note carries `scheduled_for = 2026-07-12`; open the app Sunday or later → opener asks about the return; reply confirming → run the graph page → You→Giessen gone, You→Rzeszów present; reopen chat → the event is NOT raised again (`event_prompted_at` set — verify with `/vault-inspect` or a select).

## Risks / decisions

- **14-day lookback (A2):** wide enough that a two-week app gap still catches the event, narrow enough that a months-old stale date doesn't resurrect ("how was that concert in March?" is worse than silence). Events older than 14 days at first-surfacing-opportunity silently expire — accepted. If experience says shorter, it's a one-constant change (`LOOKBACK_DAYS`).
- **Fire-once = mentioned-once, not answered-once:** if the user ignores the opener question, the event won't be re-raised. Accepted for v1 — re-ask logic needs "was it answered?" detection, which is not minimum viable. Incomplete-thread surfacing (route.ts:463-473) is the existing fallback for entities that still lack tier-1 data.
- **Mark-after-persist ordering (A4):** marking happens only after the reply is stored, so a chat-provider outage never burns the event. A crash *between* insert and update could double-raise once — harmless, self-heals next turn.
- **Reusing the 30-day TTL for the graph (C):** deliberate — one mental model ("the app trusts a current city for 30 days") across scout and graph, one constant. If 30 days feels long for a *visual* identity link, changing it means changing scout too, which is the point: don't fork the semantics.
- **Legacy `current_location` rows without `current_location_at` (C):** treated as stale (no You-link). Matches scout's existing behavior exactly; the next genuine location mention re-freshens it.
- **Ask, don't assume (D):** rejected auto-flipping `current_location` when the return date passes. Trips get extended, plans change; a wrong silent flip corrupts the profile AND scout targeting. The interviewer asks (A3), the user's answer drives the write (B3c → extract.ts:294-297), the TTL backstops non-answers.
- **`todayContext` injected every turn until marked (A4):** unchanged from today's behavior (the old query also ran every turn); the fire-once mark now bounds it to exactly one turn.

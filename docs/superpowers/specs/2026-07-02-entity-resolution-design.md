# Entity Resolution — Design

**Date:** 2026-07-02
**Status:** Approved, pending implementation plan
**Author:** session (entity-resolution work, follows typed-relationship-edges)

## Problem

A rich test conversation (a mall / coffee / pants chat) produced four incomplete
nodes, zero relation edges, and a pile of stranded duplicates. Investigation
traced this to three interlocking defects in the extraction → vault pipeline —
not the conversation, and not the (already-merged) relation-edge code:

1. **Entities never "complete."** `getTier1Missing` (`entityTypes.ts`) gates
   vault persistence on tier-1 attributes, but the params are mis-fit: `event`
   requires `What`/`When` — words the extraction prompt never teaches the model
   (it emits `Destination`/`Timeframe`), so **no event can ever complete**;
   `brand` requires a `Name` attribute that never exists because a brand's name
   is its *title*; `item` requires `Brand`, so a brand-less pair of pants stalls
   forever; a `place` named via its title (not a `Name` attribute) also can't
   satisfy `Name`.
2. **One thing becomes many nodes.** The extractor is shown only the single
   `agenda.current` entity (`synthesize.ts` `agendaContext`), so it re-introduces
   things it can't see are already tracked; and routing (`extract.ts`) matches
   entities by **exact title only**, so `Pants` → `Linen pants` →
   `Blue linen pants` became three nodes.
3. **Satellites never persist → relation edges have no endpoints.** Pending
   entities flush only on tier-1-complete or `weight ≥ 10`; `closeSession` writes
   only intent-bearing ones. A short session leaves Starbucks / a friend as
   pending, so they never become nodes and relation edges can't form.

The three interlock: fix completion + dedup and satellites persist naturally;
relation edges then light up on their own (the merged relation code is correct).

## Goal

Every distinct thing the user mentions becomes exactly **one** node that
enriches over time; durable entities complete cleanly instead of stalling; and
everything mentioned survives to the vault so the graph reflects the
conversation. No schema migration, no destructive operations — TypeScript +
prompt only.

## Non-goals (out of scope)

- **Semantic/embedding dedup (pgvector).** Robust for synonym cases
  ("sneakers" / "trainers" / "running shoes") but adds the extension, embedding
  calls, and latency — overkill for a small vault. The model-driven `refines`
  pointer (below) covers the common cases. This is the documented future lever
  if `refines` ever plateaus.
- **Redesigning the agenda focus/gravity model.** Flush-on-tier1 + gravity
  stays; we change *what* completes, not the machinery.
- **Graph database.** Postgres adjacency (`vault_notes` + `vault_links`) is
  right for this scale.

## Design

Three coordinated fixes plus a durable eval harness.

### Fix A — Realign the completion gate (`entityTypes.ts` + `synthesize.ts` prompt)

`TIER_PARAMS` tier-1 becomes each type's true minimum identity:

| type | tier-1 (was → now) | notes |
|------|--------------------|-------|
| item | `[Brand, Category]` → `[Category]` | Brand moves to tier-2 (optional); most owned things have no notable brand |
| place | `[Name, Location, Frequency]` → `[Name]` | Location/Frequency → tier-2; a named place is a valid node, an unnamed "mall" correctly waits |
| event | `[What, When]` → `[When]` | the *title* carries the "what"; Where/Who With → tier-2 |
| person | `[Name, Relationship]` → unchanged | |
| brand | `[Name, Category]` → `[Category]` | the brand's name is its title, never an attribute |

**This is load-bearing on the prompt, not just a table edit.** `getTier1Missing`
only sees `**Attr**:` lines in `content_md` — "complete" means *the matching
attribute was emitted*. So the extraction prompt (`SYSTEM` in `synthesize.ts`)
gains an explicit required-attribute section that forces the exact vocabulary:

- item → always emit `Category` (belt / shoes / laptop); `Brand` only if a store is named.
- place → emit `Name` when the place has a proper name (omit for a generic
  unnamed place — it stays a thread until named).
- person → emit `Name` (if known) and `Relationship`.
- event → always emit `When` (a date or relative time like "next week"); title = what.
- brand → always emit `Category`; the name is the title.
- Use these exact Title-Case names — never `Timeframe` for `When`, never
  `Destination` for `Where`.

Acceptance for Fix A explicitly verifies the model emits these (see Testing) —
without it, the gate stays broken exactly as today.

### Fix B — Dedup: prevention + a validated model pointer (`synthesize.ts` + `extract.ts`)

**Prevention (context).** `agendaContext` becomes `buildTrackingContext(agenda,
knownNotes)` and lists the full tracked set — `agenda.current` + `agenda.pending`
titles **plus** the recently-written vault notes (title + entity_type) — so the
model can see what already exists. `route.ts` already fetches these notes
(`vaultNotes`, 20 most-recent, line ~326) *before* the `after()` extraction
block and the array is in the closure, so `synthesize(messages, agenda,
knownNotes)` gains a third parameter and needs **no new query**. `synthesize`
stays DB-free (receives data, doesn't fetch).

**Resolution (model-driven `refines` pointer).** The extraction `SCHEMA` gains
one field per entity:

```
refines: string   // exact title of an already-tracked/in-graph entity this one
                  // is the same as or a more-specific description of; "" if new
```

Prompt rule: if a mention is the same entity as one already tracked/in-graph, or
a more specific description of it (tracked `Pants` + now "blue linen pants";
tracked `Running shoes` + now "my Nikes"), **do not create a new entity** — set
`refines` to that entity's exact title and put the new details in *this* entity's
`attributes`. Only point `refines` at a title in the tracked/graph list; leave it
`""` for a genuinely new thing. (`refines` is added to the schema's `required`
array — strict structured output requires every listed property; normalized to
`undefined`/`""` when blank.)

The model — which understands that "blue linen pants" *is* the tracked "Pants,"
a judgment blind word-subset matching ("sneakers" ⊄ "running shoes") can't make —
does the resolution; we **validate** its pointer and only act on it if it
resolves. A hallucinated pointer is a safe no-op.

**Routing merge (`extract.ts`).** In the entity-routing loop, resolve each entity
to a single merge key: `key = refines || title` (lower-cased). Look the key up in
order against `agenda.current` → `agenda.pending` → written conversation nodes
(`noteByTitle`, the existing map). On a hit, **merge** the incoming entity's
attributes / relations / brand / intent into that target (the target keeps its
canonical title; the incoming title is discarded) instead of creating a node. On
no hit, create a new entity as today. This unifies the existing exact-title merge
(`refines == title`) and the new refinement merge into one keyed lookup, and —
critically — it covers **written nodes**, which matters because Fix A's relaxed
gate lets an item flush the same turn it appears (`Pants` completes on
`Category`), ejecting it from the active set before "blue linen pants" is routed.
A net scoped to current+pending only would miss exactly the pants case. No
word-subset heuristic ships; the `refines` pointer replaces it.

### Fix C — Persist all pending on close (`extract.ts` `closeSession` + `route.ts`)

`closeSession` writes **every** pending + current entity to the vault (via the
existing `writeEntityToVault`, which sets `incomplete: true` when tier-1 is unmet
and fires `recordIntent` for intent-bearing ones), then clears the agenda. It
returns `void`.

`route.ts` opening simplifies accordingly: a stale-active conversation is closed
via `closeSession` and a fresh conversation starts with an empty agenda — no
carryover list. The **existing** "Unfinished from last session" block
(`route.ts:379-385`, which reads `incomplete: true` nodes) surfaces the
incomplete ones; complete satellites appear in "What you already know." Two now-
dead pieces are removed: the `isNewSession` flag and the "Carried over from last
session" prompt block (`route.ts:398`).

### Improvement — durable extraction eval harness (`scripts/extract-eval.ts`)

A committed replacement for the ephemeral scratchpad replay: ~40-60 lines, no
framework. Loads `.env.local`, imports the real `synthesize()`, runs 2-3 golden
transcripts (including the mall/pants one) through it, and asserts on the
extraction output — e.g. the pants window yields one item carrying a `Category`
attribute with `refines` pointing at the tracked `Pants`; the named-place window
emits a `Name` attribute; the event window emits `When`. Run with
`npx tsx scripts/extract-eval.ts`. It is a smoke test over the prompt's behavior
(temperature 0, but an LLM — not a hard CI gate), and it guards this fix from
regressing without a manual `/hypereset` → chat loop.

## Data flow

```
chat turn
  └─ route.ts: fetch vaultNotes (already happens) ─┐
  └─ after(): synthesize(messages, agenda, knownNotes)
       │   ├─ buildTrackingContext: current + pending + known note titles → prompt
       │   └─ model returns entities[] each with {attributes, relations, refines}
       └─ extractFacts(extraction)
            ├─ drill bucket → current
            ├─ gravity flush (unchanged; relaxed tier-1 completes more)
            ├─ entity routing: key = refines||title → merge into current/pending/
            │                  written node, else create new
            └─ relation post-pass (unchanged; more endpoints now exist)
  └─ on farewell: closeSession → persist ALL pending, clear agenda
```

## Files touched

- `lib/ai/entityTypes.ts` — `TIER_PARAMS` tier-1 realignment (5 types).
- `lib/ai/synthesize.ts` — `refines` in `SCHEMA` (+`required`) and `ParsedEntity`;
  required-attribute vocabulary section + `refines` rule in `SYSTEM`;
  `agendaContext` → `buildTrackingContext(agenda, knownNotes)`; `synthesize`
  third param + normalization.
- `lib/ai/extract.ts` — `RawEntity.refines`; keyed merge (`refines || title`)
  covering current/pending/written nodes; `closeSession` persist-all + return
  `void`.
- `app/api/chat/route.ts` — pass `vaultNotes` into `synthesize`; simplify opening
  carryover; remove `isNewSession` + "Carried over" block.
- `scripts/extract-eval.ts` — new eval harness (golden transcripts + asserts).

## Testing

- `tsc --noEmit` + `pnpm build` clean.
- `scripts/extract-eval.ts` passes: pants refinement collapses to one item with
  `Category`; named place emits `Name`; event emits `When`; brand emits
  `Category`.
- Live replay of the mall/pants conversation after `/hypereset`: assert **one**
  `Pants` node (Category + Color + Material), one named place, satellites
  persisted, relation edges present.

## Risks

- **Prompt compliance (Fix A + B).** Completion and dedup both depend on the
  model emitting the required attributes and honest `refines` pointers. Mitigated
  by validating `refines` against the known set (bad pointer = no-op), the eval
  harness, and the live check. If compliance is poor, the fallback is a narrow
  word-subset net (deferred, documented) or pgvector (future).
- **Early-flush churn.** Relaxed tier-1 flushes items as soon as `Category` is
  known; later color/size arrive via the existing late-fact merge path (built and
  DB-verified in session 12). The eval + live test confirm enrichment-after-flush
  still lands.
- **Relation-edge lag for pure satellites** persisted only at close: their edges
  form next session when the model re-emits the relation and the self-healing
  post-pass finds both endpoints. Fix A shrinks this by completing many
  satellites mid-session.
- **Duplicate at close** if a refinement reaches `closeSession` uncaught by the
  per-turn merge: low frequency (per-turn `refines` merge handles it); accepted
  and documented.

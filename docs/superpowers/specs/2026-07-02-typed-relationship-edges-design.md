# Typed Relationship Edges — Design

**Date:** 2026-07-02
**Status:** Approved, pending implementation plan
**Author:** session (graph-structure work)

## Problem

The knowledge graph is a **star**: `You` (`_profile.md`) links to nearly every
entity via client-side `self` edges, with only shallow tails (`You → brand →
item`). Max depth is 3; almost everything sits at depth 2. Two consequences:

1. **Fan-out crowding at scale.** With dozens of entities, `You` accumulates
   dozens of direct spokes — a dense hairball with no organizing structure.
2. **The only cross-entity edges are noise.** `tag` edges (`linkByTag`) connect
   any two conversation nodes that share a topic. A shared topic is not a
   relationship, so these are hollow or actively misleading (e.g. `Grocery
   shopping ↔ Iced Americano`, both tagged `Food`).

## Goal

Give the graph real depth and dimension by connecting entities to **each other**
through meaningful, model-emitted relationships — so structure emerges from how
the person's life actually connects (e.g. `Trip to Giessen → Giessen → Friend`),
not from a flat fan or a hollow tag join.

## Non-goals (explicitly out of scope)

- **Extraction dedup / over-extraction.** Near-duplicate nodes (e.g. `Germany` /
  `Giessen` / `Germany trip` / `Visit to Giessen`) are a separate, larger
  extraction-quality problem. This design *tolerates* duplicates — they simply
  each get their own edges — and does not attempt to merge them.
- **Per-relation-type styling / taxonomy.** All relation edges render one style;
  the label lives in the tooltip. A bounded enum of relation types can be layered
  on later if the uniform style ever feels flat.

## Design

### 1. Extraction schema + prompt (`lib/ai/synthesize.ts`)

Add a `relations` array to each entity in `SCHEMA`:

```
relations: [{ to: string, label: string }]
```

- `to` — the **title** of another entity in the conversation window this entity
  connects to (must reuse an exact entity title).
- `label` — a short verb phrase, ≤ 3 words: `"at"`, `"with"`, `"hosts"`,
  `"for"`, `"lives in"`, etc.

Prompt gains a short rule instructing the model to connect entities that
genuinely relate, using existing titles, with concise labels. Natural patterns:
event → place ("at"), event → person ("with"), item → place ("kept at" / "for"),
person → place ("lives in"). Emit nothing when no real relationship exists.

`RawEntity` (in `extract.ts`) gains `relations?: { to: string; label: string }[]`.
`synthesize()` normalizes and passes them through (default `[]`).

### 2. Edge writing (`lib/ai/extract.ts`)

- **Remove `linkByTag`** — the function and both call sites. No new `tag` edges.
- **Relationship post-pass** in `extractFacts`, after the entity-routing loop
  (so all of this turn's nodes are already written):
  1. Collect all `(sourceTitle, to, label)` triples from this batch's entities.
  2. Build a `title → note_id` map by re-querying the user's `source =
     'conversation'` vault notes (`id, title`). Resolution is case-insensitive
     and name-aware (a node whose title was upgraded from a `Name` attribute
     resolves under its final title).
  3. For each relation where **both** source and target resolve and
     `source ≠ target`: `upsert` into `vault_links`
     `{ link_type: 'relation', anchor_text: label }` with
     `onConflict: 'source_note_id,target_note_id'`.
  4. Unresolved relations are **skipped** — the model re-emits them on later
     turns, and the edge is created once both nodes exist (self-healing).
- **Resolver is a pure function** (`resolveRelation(map, source, target)` →
  ids or null) with an inline `assert`-based self-check, per project testing
  norms (no committed test runner).

### 3. Self-spine generalization (`components/graph/GraphCanvas.tsx`)

This is what actually produces layers. Currently: client-side `self` edges from
`_profile.md` to every top-level entity (items excluded because they nest under
brands).

Generalize: compute the set of nodes that have an **incoming `brand` or
`relation` edge** (= "children"). `You` links (`self`) only to nodes **not** in
that set (= roots). Children nest under their parent instead of getting a
redundant `You` spoke. Everything else (topic coloring, birth animation,
polling) is unchanged.

Result: `Trip to Giessen` (root) → `Giessen` → `Friend`, with only the trip
attached to `You`, instead of all three as `You` spokes.

### 4. Rendering (`components/graph/GraphCanvas.tsx`)

- Add `'relation'` to the `GraphLink.link_type` union.
- Style `relation` edges visibly but distinct from `brand` (faint purple) and
  the `self` spine — a subtle neutral tone, slightly stronger than the old tag
  edges were. Tooltip surfaces `anchor_text` (the label).

### 5. Data cleanup

One-time: `DELETE FROM vault_links WHERE link_type = 'tag'` to clear the existing
noisy edges. Once `linkByTag` is removed, none re-form.

## Data flow

```
chat turn
  └─ synthesize()  → entities[] each with relations:[{to,label}]
       └─ extractFacts()
            ├─ route/write entity nodes (unchanged)
            ├─ relationship post-pass: resolve titles → ids, upsert 'relation' edges
            └─ (no more linkByTag)
  └─ GraphCanvas fetch
       ├─ nodes colored by topic (unchanged)
       ├─ brand + relation edges from DB
       └─ client self-spine: You → roots only (nodes with no incoming brand/relation edge)
```

## Testing

- `tsc --noEmit` + `pnpm build` clean.
- Inline `assert` self-check on the pure `resolveRelation` function.
- Live replay: run a multi-entity conversation (e.g. the Germany trip) through
  `synthesize` → confirm `relations` emitted; check `vault_links` has `relation`
  rows resolving to the right nodes; confirm the graph nests (target entities no
  longer attach to `You`).

## Risks

- **Ordering / unresolved targets** — handled by best-effort skip + self-heal.
- **Duplicate target nodes** — out of scope; edges attach to whichever duplicate
  resolves first. Acceptable until dedup is addressed.
- **Model over-emitting relations** — mitigated by "emit nothing when no real
  relationship exists" and the ≤3-word label constraint; monitor in live test.
```

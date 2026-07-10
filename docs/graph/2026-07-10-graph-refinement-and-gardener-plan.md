# Graph Refinement + Gardener Plan (2026-07-10)

Two-layer fix for extraction quality, motivated by real vault data (44 nodes, ~9 junk).
Principle: **capture broadly, at the right grain, connected.** Salience decides *grain*
(own node vs. rolled into a parent), not *existence*. Ads read a derived sub-layer
(`intents` + future affinity), NOT the raw graph — so we never prune the graph to serve ads.

## Motivating failures (from the live seeded vault)
- Over-split: `sauce` / `pasta` / `food` — one grocery run became 3 orphan item nodes.
- Fragmented: `Coding` / `Software Development` / `AI Knowledge` / `AI training project` — one identity, 4 nodes.
- Orphaned/mistyped: `Train`, `Plane` typed as items, floating free of the trip they belong to.
- Broken title: `Sunday` (a day-of-week as an event title).
- One-off errands: `pharmacy`, `cemetery` (visited once).

Root cause: live extraction sees only an 8-turn window — no global view. Some of this is
fixable at write time; the cross-node work (merge/re-parent) is only fixable in a batch pass.

---

## PHASE 1 — Write-time refinement (`lib/ai/synthesize.ts`)

Goal: stop *broken* and *over-split* nodes at the source, without narrowing genuine capture.

### 1A. Prompt (SYSTEM string) — grain rules, not hard drops
- **Consumables at a store** (groceries, medicine, toiletries) → do NOT create item nodes;
  capture the STORE instead (brand/place). "bought pasta+sauce at Aldi" → `Aldi` brand only.
- **Transport you ride** (train, plane, bus, taxi) → NOT an item. It's part of the trip event;
  emit a relation to the trip if present, else drop. Never an owned `item`.
- **Passing places**: reconcile the contradictory "places in passing ARE extracted" line —
  keep only *named*, *recurring*, or *narratively meaningful* places (Grand Club, Starbucks,
  a cemetery tied to visiting someone). A generic one-off errand ("a pharmacy") is skipped.
- Reinforce: a title is the durable thing, never a time reference.

### 1B. Deterministic backstop (normalize step in `synthesize()`, mirrors `keepAttr`)
Reject an entity whose **title** (whole-string, anchored regex) is:
- a bare temporal token: mon–sun, today, tonight, tomorrow, yesterday, "this morning", etc.
- a generic placeholder noun already in `PLACEHOLDER_NAME` (extend the existing guard from
  the Name *attribute* to the entity *title*, for place/event types).

Backstop is the committed safety net; prompt owns the semantic calls (consumables/transport).

### 1C. Test
Extend the `synthesize.ts` `__main__` self-check: assert `Sunday`, `tomorrow`, `a pharmacy`
titles drop; `belt`, `Grand Club`, `Zara`, `Frankfurt` survive. Deterministic, no LLM.

### 1D. Confidence run (not committed)
Replay the real message slices that produced the junk through `synthesize()`; confirm the four
classes no longer emit and the good nodes still do.

---

## PHASE 2 — The Gardener (`lib/graph/reconcile.ts`)  — cleanup-only v1

Batch pass with the WHOLE graph in context. Does what streaming can't: merge, re-parent,
re-type, drop. **No synthesis in v1** (affinity/sizing/budget nodes = phase 3).

### 2A. Schema (one migration)
- `alter table vault_notes add column archived_at timestamptz;` (nullable).
- Soft-delete = set `archived_at`. Reversible = clear it. Provenance goes in `logEvent`.
- **Update every graph read to filter `archived_at is null`**: grep `from("vault_notes")`
  reads — graph page/wrapper/canvas data load, vault export route, `extract.ts` known-notes
  query. (Writes/upserts unaffected.)

### 2B. Core `reconcileGraph(userId)` (admin client, server-only)
1. Load all non-archived conversation+system nodes and edges.
2. Serialize compactly: `id | type | title | topic | key attrs`; edges `srcId -label-> tgtId`.
   **Ops reference node ids** (stable), never titles (ambiguous).
3. LLM (Gemini 2.5 Flash primary, Cerebras fallback — reuse the synthesize pattern) returns a
   strict-schema **list of operations**, NOT a rewritten graph:
   - `merge   { from_id, into_id }`
   - `retype  { id, entity_type }`
   - `add_edge{ from_id, to_id, label }`  (map containment labels → `located_in`, as `extract.ts`)
   - `drop    { id }`
   Each op carries `reason` + `confidence`.
4. Prompt rule for idempotence: "return NO operations if the graph is already clean."

### 2C. Apply (sequential best-effort, matches codebase style — not atomic, but each op reversible)
- **merge**: fold `from` attrs into `into` (dedup by title, keep `into` values); append
  `from` description to `into.content_md` if absent; repoint `vault_links` (source & target)
  `from → into`, drop self-loops + duplicate edges; set `from.archived_at`; `logEvent("gardener_merge", {from,into,reason})`.
- **retype**: update `entity_type` only (leave path; note path-prefix drift is cosmetic for v1).
- **add_edge**: upsert `vault_links` (located_in vs relation mapping).
- **drop**: set `archived_at`; `logEvent`.
- Guardrails: skip ops below a confidence threshold; **cap ops/run** (e.g. 20) against runaway rewrites.

### 2D. Trigger — on command only (v1)
- Owner-gated API route `POST /api/graph/reconcile` (guard like the existing admin dashboard),
  body `{ userId }`. Calls `reconcileGraph`. Cron wrapper is phase 3 — same core fn.

### 2E. Tests
- **Op-application self-check** (deterministic, no LLM): fixture graph → apply a hand-written
  merge/drop/add_edge op list → assert attrs folded, edges repointed, node archived, no dup edges.
- **Idempotence**: applying the same ops twice → second application is a no-op.
- **Real-data run**: run `reconcileGraph` on the seeded owner user; inspect proposed ops against
  the known junk (expect: merge 4 coding nodes, collapse groceries→Aldi, re-parent Train/Plane,
  drop Sunday). Verify the graph after; re-run → expect ~0 ops.

### 2F. Explicitly deferred (phase 3, not now — YAGNI)
- Synthesis nodes (brand affinity, sizing profile, budget bands).
- Dirty-region scoping (whole-graph is fine at current scale).
- Per-user cron; `merged_into` provenance column + auto-undo UI.

---

## Execution
Sonnet executes via dispatched subagent(s), Opus reviews each phase.
Phase 1 first (small, fast, verifiable) → review → Phase 2.

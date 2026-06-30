# Codebase Review — Interviewer Persona, Data Collection, Graph Display
Date: 2026-06-29  
Status: **Findings captured — not yet prioritized or actioned**

---

## 1. Interviewer Persona (`apps/web/app/api/chat/route.ts`)

### What's solid
- SYSTEM_PROMPT is well-structured: clear priority order, concrete ✓/✗ tone examples, specific dead-end thresholds, and session lifecycle (open/during/end)
- Dead-end rules are precise (3 replies ≤4 words, same attr asked twice with no value, 3 turns with no new facts)
- Casual mention rule prevents premature pivots mid-drill
- `buildAgendaContext` correctly surfaces tier 1 gaps and pending threads
- Dual-signal intent validation in code (model flag + forward-looking utterance marker) adds a safety layer the prompt alone can't enforce

### Gaps / risks
- **knownFacts is shallow** — just a flat title list (`- Belt`, `- Zara`). The model can't see what's already captured *about* those entities, only that they exist. It can avoid re-asking "what belt?" but still re-asks attribute questions.
- **vaultContext injects up to 20 full notes** into the system prompt with no trimming by relevance. At 20 rich notes, token cost climbs fast.
- **buildAgendaContext shows tier 1 missing but not collected attrs** — the model has to re-read vaultContext to know what it already got.
- **CHECKLIST_PROMPT is injected mid-prompt** (line 73), splitting the flow. Models read prompts top-to-bottom — burying tiered guidance mid-document risks it being underweighted.

---

## 2. Data Collection (`extract.ts`, `entityTypes.ts`, `checklists.ts`)

### What's solid
- Single-model JSON response (reply + extraction in one call) is clean
- `makeAgendaItem` synthesizes Brand from `entity.brand` so `getTier1Missing` sees it as fulfilled
- Gravity weight system (increments per turn, doubles if tier 1 unfilled, flushes at ≥10) is a soft decay that avoids hard cutoffs
- Inferred attributes with `source_utterance` give traceability
- `tier1_complete` gates vault writes cleanly
- `after()` decouples extraction from the HTTP response

### Gaps / risks
- **Dual-slot extraction schema** (`extraction.attributes` for current entity, `extraction.entities[].attributes` for new) is inherently fragile. The CRITICAL rule in the prompt helps but it's a footgun that's already fired multiple times (sessions 8–10 fixes).
- **`getTier1Missing` reads from markdown boldface** (`**Attr**:`) — if a note is written with slightly different formatting, attrs are invisible to the tier check.
- **No runtime validation of `entity_type`** — a bad LLM value would silently break graph coloring and tier logic before hitting the DB.
- **`tags` must match one of 31 topics** — enforced only by prompt instruction, no runtime check.

---

## 3. Graph Display (`components/graph/GraphCanvas.tsx`)

### What's solid
- All 31 topics have colors — no gray fallback for valid topics
- 5 entity types have distinct colors; system nodes render as hollow rings (clean visual hierarchy)
- Node size scales with degree (`4 + √(degree+1) × 4`, capped 4–20)
- Position persistence across redraws; low alpha (0.3) on updates so nodes don't teleport
- Auto-fit on first load only; preserves zoom/pan on subsequent refreshes
- Link visual hierarchy: tag edges nearly invisible (#ffffff08), brand edges faint purple

### Gaps / risks
- **Intent flag not rendered** — a node with `intent: true` looks identical to one without. No visual cue that "this is something the user wants to buy."
- **No click-to-expand behavior** — nodes are visual only, no way to surface underlying content.
- **No fetch limit** — graph fetches all notes + all links with no pagination. At 50+ notes it becomes visually noisy.
- **Zoom floor is 0.1x** — essentially makes the graph invisible at minimum zoom.
- **4-second refresh delay is a guess** — if extraction runs long, the graph fires before data lands and doesn't update until next turn.

---

## Next step (when returning to this)
Pick one of three angles:
- **a) Fix specific issues** — intent visibility, knownFacts enrichment, entity_type validation, tag runtime check
- **b) Redesign one area** — e.g. rethink graph interaction model (click-to-expand, intent indicators)
- **c) Other** — e.g. connect this to landing page or onboarding work

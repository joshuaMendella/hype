# Implementation Plan — Persona, Extraction, Graph & Ad Layer
Date: 2026-06-30
Status: **Drafted — awaiting go-ahead**
Builds on: `2026-06-29-codebase-review.md` (findings) + 2026-06-30 co-founder review

## End goal (never lose sight of)
A warm, transparent AI friend that people *want* to talk to repeatedly; a capture
pipeline that reliably banks the commercially-core facts (brand, size, dates, **intent**)
without interrogating; a graph that feels alive enough to be the retention hook; and a
quietly-growing data layer that turns consented intent into affiliate/ad revenue.

## Guiding principle for the rewrite
**Separate the agenda's "wants" from the conversation's "asks."** The extraction layer
tracks what's still missing (for deferred re-asks); the live chat prompt is NOT handed that
as a per-turn checklist. Drill depth scales with user investment + intent, not a flat tier-1
requirement. Facts accrue across turns and sessions — "extract eventually," not "extract now."

---

## Phase 1 — Decouple extraction from the chat turn  *(unblocks everything; biggest bug-killer)*
> **Status: DONE + runtime-verified (2026-06-30).** `lib/ai/synthesize.ts` added. Extraction runs on **Cerebras gpt-oss-120b (free)** with strict `json_schema` structured outputs (model isolated to one fetch block — swap to Sonnet later by editing only that block). `route.ts` interview path returns plain text; onboarding keeps a tiny JSON contract; `after()` runs `synthesize → extractFacts`. tsc + `pnpm build` clean; smoke-tested live against Cerebras (strict schema accepted, valid JSON, correct intent + title/attribute split). Also fixed `getTier1Missing` to be case-insensitive (model emits lowercase attr titles). Uses existing `CEREBRAS_API_KEY` — no new key. **Cost: $0** (free tier; rate-limited).
**Why:** one free-tier call currently does conversation + classification + JSON extraction +
intent scoring. Every session-8/9/10 extraction bug (attribute bleed, JSON leak, brand-sync)
traces to this overload.

**Changes**
- `app/api/chat/route.ts`: chat call returns **reply text only**. Delete the entire
  `## Response format` + `extraction.*` schema from `SYSTEM_PROMPT`. Remove `tryParse`,
  JSON-recovery regex, and dual-signal intent patching from the route.
- New `lib/ai/synthesize.ts`: dedicated extraction pass over a sliding window (~last 8
  turns) + current agenda, calling **Cerebras `gpt-oss-120b` (free)** with strict
  `json_schema` structured outputs. Returns `ExtractionResult`. Model isolated to one fetch
  block — swap to Anthropic Sonnet (higher accuracy) later by editing only that block.
- `route.ts` `after()` now calls `synthesize(window, agenda)` → feeds existing `extractFacts()`.
  Keep it async/off the hot path; chat stays on Cerebras (fast/free).
- Keep `extractFacts()` (agenda gravity + vault writes) as-is — it just gets cleaner input.

**Acceptance:** chat reply never contains JSON; vault still populates; the attribute-bleed /
JSON-leak bug classes are structurally impossible because chat no longer parses JSON.

**Skipped for now:** pgvector embedding dedup. `knownTitles` is exact-string match and will
fragment ("belt" vs "Zara belt") — *add when fragmentation actually shows in a real vault*,
not before. (ponytail: don't add the dep speculatively.)

---

## Phase 2 — Persona rewrite (depends on Phase 1)
> **Status: DONE (2026-06-30).** `SYSTEM_PROMPT` in `route.ts` reframed around a "curious friend who harvests facts from stories." Added: the hard-fact **ladder** (harvest → infer+confirm → ask once then drop → defer to a later session), **drill depth ∝ user energy/intent**, a **Rhythm** rule that breaks the relentless one-question cadence (allows reactions/light opinions with no question), **cross-fact connection** using `vaultContext` ("you run mornings — are those shoes for that?"), and **intent = offer value, not probe** ("want me to keep an eye out for deals?"). Softened the two mechanism-leaking spots: `buildAgendaContext` now reads as "on your mind right now (a gentle thread, not a checklist)… if it comes up naturally" instead of "still need tier 1: X"; `CHECKLIST_PROMPT` (checklists.ts) reworded from "Tier 1 — always capture first, unlocks vault writes" to "what's worth knowing… if it surfaces naturally." Response-format line updated to permit the no-question turn. tsc + `pnpm build` clean. Deferred re-asks still ride on existing "Unfinished from last session" infra. **Live-conversation acceptance check still pending** (needs a real test chat — flagged to owner).

**Why:** once chat doesn't emit JSON, the prompt is free to be a conversation. Resolve the
brand/transparency tension: interviewer is openly an AI building your profile (already stated
in onboarding); it just must stop *acting* covert.

**Changes to `SYSTEM_PROMPT`**
- Reframe around the principle above. Lead with **story-eliciting open questions**; harvest
  facts from the narrative instead of asking for fields.
- **Get hard facts via the ladder:** (1) harvest from story → (2) infer + soft-confirm →
  (3) one soft direct follow-up then drop → (4) defer missing fields to a future session.
- **Drill depth ∝ investment/intent.** Passing mention = one light question. Excited / wants
  to buy = full drill. Add this as an explicit rule.
- Allow occasional **reciprocity** (a light opinion/observation) and breaking the rigid
  "one reaction + one question" cadence — the relentless cadence is itself the interrogation tell.
- Add **cross-fact connection** instruction: use `vaultContext` to link facts
  ("you run mornings — are those shoes for that?"). This is the highest-warmth move.
- **Intent = offer value, not probe.** On forward-looking language, reflect + offer to watch
  for deals (sets up the consent ad moment). Never ask "are you going to buy X?"
- `buildAgendaContext`: downgrade from "still need tier1: X" (reads as a to-do list) to soft
  "if it comes up naturally" phrasing. Tier-1 gaps live in the agenda for deferral, not as
  this-turn asks.

**Lean on existing infra:** "Unfinished from last session" already feeds deferred re-asks —
this is where missed brands/sizes/dates come back naturally.

**Acceptance:** in a test convo, the AI gets brand/size/date inside answers to open questions;
when a fact is withheld it asks once, drops, and the field shows up in next session's "unfinished."

---

## Phase 3 — Make the graph feel alive  *(independent; the retention hook)*
> **Status: DONE (2026-06-30).** `GraphCanvas.tsx` overhaul. **You connected & central:** synthesize client-side (never persisted) `link_type:"self"` edges from `_profile.md` to every top-level entity (anything not already a brand-child); items stay nested under brands, everything else links straight to You — one connected web. **One color axis:** `nodeColor` now colors *every* node by topic; dropped the system=hollow-ring / entity=filled split and the `ENTITY_TYPE_COLORS` second palette (entity_type shows in the tooltip). **Edges visible:** tag edges raised from `#ffffff08`→`#ffffff1a`, self spine `#ffffff33`, brand `#a78bfa45`. **Node birth:** `seenNodeIdsRef` diffs IDs across redraws; genuinely-new nodes scale in (elastic) with a one-shot glow pulse — silent on first load and on resize. **Polling:** replaced the single blind 4s reload with two fetches (3s + 6.5s); the birth-diff makes the second idempotent, so slow extractions still surface. Added a color for the `Events` topic (housekeeping reconcile) and removed the stray repo-root `nul` file. tsc + `pnpm build` clean. `GraphLink.link_type` union extended with `"self"`.

**Why:** "watch your graph grow" is the core loop and currently a silent 4s full reload.
Color language is split-brain; "You" is isolated; dominant edge type is invisible.

**Changes to `GraphCanvas.tsx` (+ minor schema reads)**
- **You at the center, connected.** Add edges from the `_profile.md` root to each entity's
  primary topic (or to a light, visible theme node). The home screen should read as a portrait
  of the self, not a floating dot beside disconnected brand pairs.
- **One color axis.** Color every node by **topic/theme**. Encode `entity_type` with a small
  icon/inner dot if needed — drop the system=hollow-ring / entity=filled distinction (users
  don't care about `source`).
- **Make connections visible.** Raise tag-edge opacity from `#ffffff08` to something readable;
  a knowledge graph's appeal *is* the connectedness.
- **Dramatize node birth.** On refresh, diff new node IDs vs previous; pulse / scale-in +
  brief highlight on genuinely new nodes. This is the motivating moment — currently silent.
- Replace the blind `4000ms` setTimeout with a completion signal where cheap (e.g. chat
  response returns `extractionPending: true` and canvas polls once), else keep the delay but
  ship the birth-animation as the visible win.

**Acceptance:** new node visibly animates in after a reply; graph reads as one connected web
centered on You; color means exactly one thing.

---

## Phase 4 — Advertiser data layer  *(seed cheap now; expensive to backfill)*
> **Status: DONE — except life-events-as-first-class, deferred (2026-06-30).** Migration `phase4_advertiser_data_layer` applied to Supabase (verified: `intents` table exists, RLS on, `intents: own` policy, partial index on open intents; no new security advisories). **`intents` table** (`user_id, entity_note_id, category, utterance, confidence, status open|offered|converted|expired, created_at, expires_at`). **`profiles.ad_preferences` JSONB** `{category: bool}` for per-category consent. **`lib/ads/categories.ts`** — static topic→affiliate-category map (`affiliateCategory()`); non-commercial topics return null. **Wired:** `extract.ts` `recordIntent()` fires inside `writeEntityToVault` for both entity branches when `item.intent` — inserts one open intent with category (from the map) + utterance + confidence + 30-day expiry; dedups against an existing open intent for the same entity. `AgendaItem` gained `intent_utterance`/`intent_confidence`; `makeAgendaItem` carries them through. Types: `Profile.ad_preferences`, new `Intent`/`IntentStatus`. schema.sql updated. tsc + `pnpm build` clean. **Live-conversation acceptance check pending** (needs a real intent utterance to flow end-to-end). **Deferred — life events as a first-class typed signal:** under-specified (no storage target defined) and outside the stated acceptance; life events already flow as `event` entities tagged `Life Events`. Add a dedicated typed signal when the ad-targeting layer actually consumes it (ponytail: don't build the speculative table).

**Why:** mostly independent of UX. The signals that make the vault sellable cost little to
capture today and a lot to reconstruct later.

**Changes**
- **Intent lifecycle.** New `intents` table: `entity_note_id, category, utterance, confidence,
  status (open|offered|converted|expired), created_at, expires_at`. Populate from synthesis
  when `intent:true`. CPA/affiliate revenue lives in this lifecycle, not a boolean snapshot.
- **Life events as a first-class signal.** Synthesis flags type + date + confidence (move, job,
  baby, wedding, breakup) — these target better than any single purchase.
- **Topic → affiliate-category map.** Static `lib/ads/categories.ts` mapping topics/categories
  to Amazon/affiliate search terms. (ponytail: a static map, not a service — Day-1 affiliate
  needs nothing more.)
- **Per-category consent.** `profiles.ad_preferences` JSONB `{category: bool}`; UI ships with
  the first ad card. This is what makes a referral "verified consent" and worth $1.50–3.00.

**Acceptance:** an expressed intent creates an `intents` row with an expiry; a known category
maps to an affiliate search term; consent state is queryable per category.

---

## Sequencing
- **1 → 2** (extraction decouple unblocks the persona rewrite)
- **3** and **4** run in parallel with 1–2 (front-end / data-model, no dependency)
- Suggested order with zero users: **1, 2, 3, then 4** — capture quality + retention before ad
  plumbing, but seed Phase 4's cheap signals as soon as Phase 1's synthesis pass exists.

## Housekeeping (fold into whichever phase touches the file)
- `extract.ts`: remove dead `getMissingAttrs` import.
- `TOPIC_COLORS` has `Life Events` but topics list has `Events` (no color) — reconcile.
- Add runtime validation of `entity_type` + `tags` in synthesis (per 2026-06-29 review).
- Delete stray `nul` file in repo root.

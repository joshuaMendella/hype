# Hype — Claude Code Context

## What this project is
AI-powered personal knowledge graph. An AI interviewer learns about the user over time and builds an Obsidian-compatible vault of markdown notes. The graph visualization IS the home screen — users watch their knowledge graph grow as they talk to the AI.

## Business model (session 4 decision)
**Free to users. Revenue from consent-based conversational advertising.**
- The data contract is transparent and front-and-center at onboarding: the interview builds a personal profile, that profile powers tailored offers, the user controls what they see and when
- When the vault detects a relevant intent (e.g. user wants a shirt), the interviewer offers to surface current deals — user says yes or no, nothing is forced
- Advertisers pay CPC ($1.50–3.00) or CPA (8–12% of transaction) for verified, consent-confirmed referrals
- Day-one revenue: affiliate links (Amazon Associates, Ticketmaster, Booking.com) — no advertiser relationships needed
- Slogan: "Be in control of your ads. Only see what you want, when you want it."
- Full analysis: `HYPE_BUSINESS_ASSESSMENT.md` in repo root

## Repo
- GitHub: https://github.com/joshuaMendella/hype
- Local: C:\Users\mende\desktop\hype
- Monorepo: Turborepo + pnpm workspaces

## Stack
- **Web**: Next.js 16 + TypeScript + Tailwind CSS (apps/web)
- **Mobile**: React Native + Expo — not started yet (apps/mobile)
- **Database**: Supabase (Postgres + Auth) — project ref: aykjvvtolkaqvijfeewn
- **AI**: Groq (Llama 3.3 70B) — chat interviewer, free tier. Anthropic Sonnet — planned for extraction synthesis
- **Graph**: D3 force simulation (custom, no react-force-graph)
- **Deploy**: Vercel (not yet configured)

## Key architectural decisions
- Dual-layer: Postgres = primary source of truth, Markdown vault = AI/human-readable memory layer
- Every vault note = one graph node; every [[wikilink]] = one graph edge
- Service role key is NEVER used client-side — only in API routes
- RLS enabled on all tables — users can only access their own data
- Three Supabase clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR), `lib/supabase/admin.ts` (server-only, bypasses RLS)

## What's been built (as of 2026-06-28, updated session 10)
- [x] Monorepo scaffold (Turborepo, pnpm, TypeScript)
- [x] Next.js app scaffolded in apps/web
- [x] Supabase schema: profiles, vault_notes, vault_links, conversations, messages, extractions
- [x] RLS policies + triggers (auto-create profile + root vault note on signup)
- [x] Auth middleware (protects /graph, redirects unauthenticated)
- [x] Login + Signup pages (/login, /signup)
- [x] Graph page (/graph) — full-screen D3 force graph + conversational UI overlay
- [x] GraphCanvas component — Obsidian-style, topic colors, zoom/pan/drag, tooltips, zoom capped at 1.5x
- [x] ChatPanel component — full-screen conversational UI (AI top-center, input bottom-center, typewriter reveal, Poppins font)
- [x] GraphWrapper component — thin client wrapper sharing refreshTrigger state between GraphCanvas and ChatPanel
- [x] /api/chat — Cerebras gpt-oss-120b interviewer, vault context, known-facts, today's events, drill-down, brand rule, deflection, agenda injection
- [x] lib/ai/extract.ts — entity-centric extraction (Topic → Brand → Item or Topic → Entity), no You→Topic links, agenda update after each run
- [x] lib/ai/checklists.ts — required attributes per topic, Agenda type, CHECKLIST_PROMPT for system prompt
- [x] lib/ai/topics.ts — 31 topics
- [x] lib/ai/categories.ts — topic → subcategories map (still present, not used in graph routing)
- [x] Supabase: conversations.agenda JSONB — tracks current entity + pending threads across turns
- [x] Graph updates — event-driven (fires once 4s after each chat reply)
- [x] Supabase: reset_vault(user_id) function — idempotent vault wipe, re-seeds "You" root at _profile.md
- [x] Supabase: scheduled_for date column on vault_notes + partial index for today's event queries
- [x] HYPE_BUSINESS_ASSESSMENT.md — business memo: consent-based ad model, unit economics, next steps
- [x] Single-model extraction — 70B (Cerebras gpt-oss-120b) returns JSON with reply + extraction data in one call; 8B Groq call eliminated from hot path
- [x] extractFacts() decoupled from LLM — receives pre-extracted data, handles only agenda management + vault writes
- [x] Chat provider switched to Cerebras (free tier, gpt-oss-120b, 120B params, reasoning model)
- [x] Interviewer persona redesigned (session 7) — new SYSTEM_PROMPT: banned hollow phrases, ≤12-word reaction cap, numbered focus priority, explicit memory-check rule, conversational drill-down phrasing, concrete dead-end thresholds, 3 session-end triggers, 4 input-handling cases (off-topic/emotional/jailbreak/sensitive), honest AI identity
- [x] ONBOARDING_PROMPT — 4-step first-conversation intro, waits for user ack at each step, `onboarding_complete` signal marks profile as onboarded
- [x] profiles.onboarded BOOLEAN — gates onboarding flow; set false → onboarding, set true → normal interview
- [x] /hypereset skill — wipes vault, clears agenda, resets onboarded flag in one command
- [x] Onboarding flow fixed (session 8) — ChatPanel now fetches opening from API on mount (messages: []); removed hardcoded opening() that bypassed server; route accepts empty messages array
- [x] Onboarding skip-ahead rule tightened — "let's do it" now advances to next step, not Step 5; only explicit "skip this" / "just start already" jumps ahead
- [x] JSON leak fix — model sometimes outputs text before JSON block; regex fallback extracts and retries the JSON block, preventing silent extraction failure
- [x] Attribute bleed fix — entity-level attributes now nested inside extraction.entities[].attributes; top-level extraction.attributes is drill-down only (existing agenda entity); makeAgendaItem seeds attributes + missing from entity-level attrs
- [x] Topic name enforcement — extraction prompt now inlines full topic enum instead of soft "from the list above" reference; prevents free-form topics like "Place visited"
- [x] City/hometown detection — interviewer drill-down rule added: "my city X" → AI confirms as home city, captured as Location entity
- [x] Typewriter speed slowed (52ms → 85ms per word)
- [x] Dynamic font size in ChatPanel — scales down for longer AI messages (>100 chars, >200 chars breakpoints)
- [x] /hypesave skill — end-of-session commit + push command
- [x] Hype__Suggestions.docx reviewed — design proposals for extraction quality, graph structure, advertiser profile (session 9)
- [x] lib/ai/entityTypes.ts — 5 entity types (item/brand/place/person/event) with tier 1/2/3 parameter stacks; tier 1 completion unlocks vault write (PR #1)
- [x] checklists.ts refactored — AgendaItem gains weight, tier1_complete, tags fields; CHECKLIST_PROMPT rewritten around tiered priority (tier 1 always, tier 2 naturally, tier 3 only if it comes up) (PR #1)
- [x] extract.ts — vault paths now entity-type-rooted (item/zara/belt.md); gravity weight system increments each turn (doubles if tier 1 unfilled), flushes at weight≥10; inferred attrs marked *(inferred)* in notes; incomplete nodes get frontmatter flag (PR #1)
- [x] route.ts — extraction schema updated to entity_type + tags[] (tags emerge from attrs, never assigned upfront); buildAgendaContext soft re-anchor (2–3 turn follow + steer back) replaces hard topic-block; dual-signal intent validation (model flag + forward-looking utterance marker) (PR #1)
- [x] Phase 4 — hub node removal: type hub nodes (item/index.md etc.) eliminated; entities write directly to vault; entity_type stored on vault_notes (PR #2)
- [x] Phase 4 — attribute-based edges: linkByTag() creates shared-topic edges (link_type='tag') between conversation nodes; brand→item edges carry link_type='brand' (PR #2)
- [x] Phase 4 — GraphCanvas visual overhaul: TOPIC_COLORS expanded to all 31 topics (fixes gray node bug); ENTITY_TYPE_COLORS added (5 types); entity nodes colored by entity_type, system hubs by topic; system nodes render as hollow rings; tag edges barely-visible white, brand edges faint purple; tooltip shows entity_type (PR #2)
- [x] Supabase schema: vault_notes.entity_type + vault_links.link_type columns added + migrations applied (PR #2)
- [x] Reviewer annotation feature — `[notes in brackets]` in chat input stripped before LLM call, stored raw in Supabase messages for session review; placeholder hint added (session 10)
- [x] Extraction bug fixes (session 10) — brand attr synced to agenda.current.brand when it arrives mid-drill; makeAgendaItem synthesizes Brand attr from entity.brand so getTier1Missing sees it fulfilled; attribute bleed from current entity fixed via prompt CRITICAL rule (new entity introduction → attrs go to entity seed, not global slot)
- [x] Interviewer behavior fixes (session 10) — "I don't know" dead-end rule (rephrase once max, then drop); open-ended wrap-up after 4+ attrs ("anything else?"); casual mention rule (don't pivot immediately on passing mention, finish current drill first)
- [x] Session lifecycle (session 10) — conversations.updated_at auto-trigger (Postgres); 2h timeout detected on opening request → old conversation closed, pending queue + current entity carried to new conversation; incomplete vault_notes injected into system prompt as "Unfinished from last session"; session topic limit (3 entities per conversation) with wrap-up instruction; farewell detection ("Talk soon." etc.) closes conversation immediately
- [x] **Phase 1 — extraction decoupled from chat (session 11)** — `lib/ai/synthesize.ts`: dedicated extraction pass over the last ~8-turn window + current agenda, using **Cerebras gpt-oss-120b (free tier)** with **strict structured outputs** (`response_format: json_schema, strict: true`) so the response is always schema-valid — this structurally eliminates the JSON-leak / attribute-bleed / parse bug class. Chat call now returns **plain text** on the interview path (extraction schema removed from SYSTEM_PROMPT); onboarding keeps a tiny `{reply, onboarding_complete}` JSON contract. `route.ts` `after()` runs `synthesize → extractFacts` async, off the hot path. Dual-signal intent validation moved into synthesize.ts. extractFacts (agenda gravity + vault writes) unchanged. Extraction model is isolated to one fetch block in synthesize.ts — swap to Anthropic Sonnet (or any provider) later by editing that block only. tsc + `pnpm build` clean; **runtime-verified** against live Cerebras (strict schema accepted, valid JSON, correct intent + title/attribute split). **Implements plan `docs/superpowers/specs/2026-06-30-implementation-plan.md` Phase 1.** Uses existing `CEREBRAS_API_KEY` — no new key needed.
- [x] **Extraction integration fixes (session 11)** — `getTier1Missing` made case-insensitive (model emits lowercase attr titles like `category`; tier params are Title Case `Category` — exact match would have read present attrs as missing and blocked vault writes). synthesize.ts prompt: title = bare noun + descriptors/Category go in attributes (was folding "black leather belt" into the title); Title-Case attribute names nudge; require a one-sentence description per entity.
- [x] **Phase 2 — persona rewrite (session 11)** — `SYSTEM_PROMPT` reframed from a covert questioner into a "curious friend who harvests facts from stories." Added the **hard-fact ladder** (harvest from story → infer + soft-confirm → ask once then drop → defer to a later session), **drill depth ∝ user energy/intent** (passing mention = one light question; excited/planning = full drill), a **Rhythm** rule that breaks the relentless one-question cadence (may react or offer a light opinion with no question — never two questions), **cross-fact connection** using vaultContext ("you run mornings — are those shoes for that?"), and **intent = offer value, not probe** ("want me to keep an eye out for deals?"). Softened the two mechanism-leaking spots: `buildAgendaContext` now reads "on your mind right now (a gentle thread, not a checklist)… if it comes up naturally" (was "still need tier 1: X"); `CHECKLIST_PROMPT` (checklists.ts) reworded from "Tier 1 — always capture, unlocks vault writes" to "what's worth knowing… if it surfaces naturally." Deferred re-asks still ride on existing "Unfinished from last session." Implements plan Phase 2. tsc + build clean. **Live-conversation acceptance check still pending.**
- [x] **Phase 3 — graph feels alive (session 11)** — `GraphCanvas.tsx`. **You connected & central**: client-side (never-persisted) `link_type:"self"` edges from `_profile.md` to every top-level entity (items stay nested under brands; everything else links straight to You) → one connected web instead of a floating dot. **One color axis**: every node colored by topic; dropped the system-hollow-ring/entity-filled split and the `ENTITY_TYPE_COLORS` second palette (entity_type now lives in the tooltip only). **Edges visible**: tag `#ffffff08`→`#ffffff1a`, self spine `#ffffff33`, brand `#a78bfa45`. **Node birth**: `seenNodeIdsRef` diffs node IDs across redraws; new nodes scale in (elastic) + one-shot glow pulse (silent on first load and on resize). **Polling**: single blind 4s reload → two fetches (3s + 6.5s), birth-diff makes the second idempotent so slow extractions still surface. Added `Events` topic color; removed stray repo-root `nul` file. `GraphLink.link_type` union gained `"self"`. Implements plan Phase 3. tsc + build clean.
- [x] **Phase 4 — advertiser data layer (session 11)** — Migration `phase4_advertiser_data_layer` applied to Supabase (verified: `intents` table + RLS + `intents: own` policy + partial index on open intents; no new security advisories). **`intents` table** (entity_note_id, category, utterance, confidence, status open|offered|converted|expired, created_at, expires_at) — the CPA/affiliate lifecycle, not a boolean. **`profiles.ad_preferences` JSONB** for per-category consent. **`lib/ads/categories.ts`** static topic→affiliate-category map (`affiliateCategory()`; non-commercial topics → null). **Wired**: `extract.ts` `recordIntent()` fires in `writeEntityToVault` (both branches) when `item.intent` — one open intent row with category + utterance + confidence + 30-day expiry, dedup-guarded against an existing open intent for the same entity. `AgendaItem`/`makeAgendaItem` carry `intent_utterance`/`intent_confidence`. Types: `Profile.ad_preferences`, `Intent`/`IntentStatus`. schema.sql updated. Implements plan Phase 4. tsc + build clean. **Deferred**: life-events-as-first-class typed signal (under-specified, not in acceptance; already flows as `event` entities tagged Life Events — add when ad-targeting consumes it). **Live-conversation acceptance check pending.**

## Claude Code plugins installed (user-scoped, active next session)
- `context-mode` — keeps large outputs out of context window (was pre-installed)
- `claude-code-setup` — run "recommend automations for this project" at session start
- `frontend-design` — auto-activates when building UI
- `ponytail` — prevents over-engineering, enforces minimum viable code

## START OF NEXT SESSION checklist
1. Run `git log --oneline -5` to confirm state
2. Run `cd apps/web && pnpm dev` to start the dev server
3. Chat AND extraction both run on Cerebras gpt-oss-120b (free tier) — CEREBRAS_API_KEY in .env.local. Chat = conversational reply (plain text); extraction = separate strict-json_schema call in lib/ai/synthesize.ts. No Anthropic key needed.
4. To reset everything for testing: `/hypereset` (wipes vault, clears agenda, resets onboarding flag)
5. Root "You" node is always at path `_profile.md`, topic `Profile` — extraction depends on this
6. `.mcp.json` is gitignored — Supabase MCP needs `SUPABASE_ACCESS_TOKEN` set locally in the file (not committed)
7. Next focus: landing page at / ("Be in control of your ads" + "Build your personal graph"), then Vercel deploy

## Key extraction rules (updated session 9)
- Entity-centric graph: entity-type hub → Brand hub → Item (vault paths: `item/zara/belt.md`, `place/monmouth-coffee.md`)
- 5 entity types: item, brand, place, person, event — each has tier 1/2/3 parameter stacks in entityTypes.ts
- Vault write triggers on tier1_complete (brand + category for items, name + location + frequency for places, etc.) — NOT on all-attrs-filled
- Gravity agenda: each pending AgendaItem carries a weight (increments each turn; doubles if tier 1 unfilled); flushes at weight≥10 with incomplete: true frontmatter — soft decay replaces old 5-turn hard cutoff
- Inferred attributes allowed with `inferred: true` flag + source_utterance ("I go there every Sunday" → Frequency: weekly, inferred)
- Tags emerge from extracted attributes post-extraction — never assigned upfront; open-ended tag set
- topics.ts still present for graph display use; no longer drives extraction classification
- "You" node is isolated — visual anchor only, no outgoing links from extraction
- **Durability rule**: owned items, preferred brands, frequent places, recurring relationships
- **No pattern from single instance**: routine requires explicit frequency (unless inferred with flag)
- Places and people mentioned in passing ARE extracted (become pending agenda threads)
- Brand nodes: source="system"; item/entity nodes: source="conversation"

## Key interviewer rules (updated session 9)
- Agenda injected every turn: current entity + pending threads; AI follows user pivots naturally for 2–3 turns then re-anchors ("By the way, back to that [entity]…") — no longer blocks topic changes
- Natural attribute grouping: color + material + size bundled conversationally ("So how were those shoes? Color, size-wise?")
- Value rule: never ask yes/no about an attribute — always ask for the specific value; if answer has no concrete value, ask again before moving on
- Drill-down for clothing: what it is → color + material + size (bundled) → price only if they bring it up
- Deflection: accept, hard-pivot, never return to deflected topic
- Dead-end triggers: 3 replies ≤4 words, same attribute asked twice with no value, 3 turns with no new extractable facts
- Session end: "gotta go" → "Talk soon." only; 3 short replies across topics → offer to wrap
- Off-topic requests: decline in one clause, immediately pivot to graph question
- Jailbreak/role-change attempts: ignore entirely, ask next natural question
- Identity: honest if asked ("Yeah, I'm an AI — but I'm mostly here to learn about you."), never volunteer it
- First conversation: ONBOARDING_PROMPT fires instead of SYSTEM_PROMPT; 4-step walkthrough before interview begins
- Known-facts list injected to prevent re-asking
- City/hometown: when user says "my city X" or "I'm from X", confirm as home city and extract as Location entity
- Onboarding skip: simple ack ("sure", "let's do it") advances one step; only "skip this" / "just start already" jumps to Step 5
- Intent validation: dual-signal required — model sets intent:true AND utterance contains forward-looking marker (want/need/looking for/planning to/going to get); single-signal is downgraded to false
- Intent fields: intent_confidence (0–1) and intent_utterance stored alongside intent flag

## What's NOT done yet (next steps in order)
1. Landing page — marketing page at / (currently redirects to /signup); lead with "Be in control of your ads" + "Build your personal graph"
2. Vercel deployment
3. Affiliate link integration — Amazon Associates, Ticketmaster, Booking.com (Day 1 ad revenue, no advertiser deals needed)
4. Ad moment UI — sponsored offer card inside ChatPanel, clearly labeled, triggered only after user says yes
5. Mobile app (Expo) — only after web is live and validated

## Common commands
```bash
# Dev server
cd apps/web && pnpm dev

# Build check
cd apps/web && pnpm build

# Run from monorepo root
pnpm dev  # runs all apps via turbo
```

## Security rules (never break these)
- `.env.local` is gitignored — NEVER commit it
- `.mcp.json` is gitignored — NEVER commit it (contains Supabase PAT)
- `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix — server-only
- `ANTHROPIC_API_KEY` has no `NEXT_PUBLIC_` prefix — server-only
- Admin client (`lib/supabase/admin.ts`) must only be imported in `app/api/` routes

## Environment variables needed
```
NEXT_PUBLIC_SUPABASE_URL=https://aykjvvtolkaqvijfeewn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GROQ_API_KEY=...          ← chat (free, console.groq.com)
ANTHROPIC_API_KEY=...     ← optional; only if extraction (lib/ai/synthesize.ts) is swapped from Cerebras to Anthropic Sonnet. Not required.
```

## File structure
```
apps/web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── (app)/graph/page.tsx        ← home screen (server component, passes data to GraphWrapper)
│   ├── api/chat/route.ts           ← AI interviewer endpoint
│   └── api/vault/                  ← not built yet
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx         ← D3 graph (refreshTrigger prop, no polling)
│   │   └── GraphWrapper.tsx        ← client wrapper: shares refreshTrigger between canvas + chat
│   └── chat/ChatPanel.tsx          ← AI chat overlay (onReply callback)
├── lib/
│   ├── supabase/client.ts          ← browser client
│   ├── supabase/server.ts          ← SSR client
│   ├── supabase/admin.ts           ← service role (server-only)
│   └── ai/
│       ├── synthesize.ts           ← Cerebras gpt-oss-120b extraction pass (strict json_schema) — feeds extractFacts; runs async off the chat turn; model swappable in one fetch block
│       ├── extract.ts              ← extractFacts: agenda gravity + vault writes (now fed by synthesize.ts, no longer LLM-coupled)
│       ├── entityTypes.ts          ← 5 entity types with tier 1/2/3 parameter stacks (source of truth for extraction)
│       ├── checklists.ts           ← AgendaItem/Agenda types, CHECKLIST_PROMPT (tiered)
│       ├── topics.ts               ← 31 topics (used for tags + graph display, not extraction classification)
│       └── categories.ts           ← topic → subcategories map (kept, not used in routing)
├── types/database.ts               ← all TypeScript types
└── supabase/schema.sql             ← full DB schema
```

## Owner
- Joshua Mendella (joshuaMendella on GitHub)
- Windows 11, no Mac — iOS builds via EAS Build
- New to git/GitHub — handle all git operations
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe (add to PATH in PowerShell: $env:PATH += ";C:\Program Files\GitHub CLI")

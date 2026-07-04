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

## What's been built
The full session-by-session build log lives in **[CHANGELOG.md](CHANGELOG.md)** (sessions 1–15). Its current-state facts are also reflected in the rules, file-structure, and next-steps sections below.

## Claude Code plugins installed (user-scoped, active next session)
- `context-mode` — keeps large outputs out of context window (was pre-installed)
- `claude-code-setup` — run "recommend automations for this project" at session start
- `frontend-design` — auto-activates when building UI
- `ponytail` — prevents over-engineering, enforces minimum viable code

## START OF NEXT SESSION checklist
1. Run `git log --oneline -5` to confirm state
2. Run `cd apps/web && pnpm dev` to start the dev server
3. Chat AND extraction both run on **Gemini 2.5 Flash primary** (GEMINI_API_KEY), with **Cerebras gpt-oss-120b as fallback** (CEREBRAS_API_KEY) if Gemini fails/rate-limits. Chat = `app/api/chat/route.ts` (`geminiChat`→`cerebrasChat`), plain text on the interview path. Extraction = `lib/ai/synthesize.ts`, separate structured-output call. Both keys in .env.local; no Anthropic key needed.
4. To reset everything for testing: `/hype-reset` (wipes vault, clears agenda, resets onboarding flag)
5. Root "You" node is always at path `_profile.md`, topic `Profile` — extraction depends on this
6. `.mcp.json` is gitignored — Supabase MCP needs `SUPABASE_ACCESS_TOKEN` set locally in the file (not committed)
7. **Extraction graph is verified clean-slate (session 13); session 14 added org type + base-profile + wrap/resurface fixes (all live-test pending).** Open items: (a) **live-test session-14's four fixes** — `/hype-reset` → open with your job, ~10 turns, mention an unnamed place, hit a lull; confirm org node, `base_profile` age/home saved, no early wrap, placeholder circles back, base question only in the lull; (b) narrow the item→place relation (intent items pick up a stray link to the mall, not just the stores); (c) session-12 #5 persona phrasing (confirm-before-ending, warm sign-off) + the farewell→reload→carryover loop remain live-test pending.
8. **Landing page is built** (session 16) — dark Revolut-style page at `/`, `components/marketing/`, flagship consent-only-ads section. **Immediate focus: visual polish** (user feedback: "good start, room for improvement" — hero legibility with the graph behind the headline, consent-toggle feel, exact "consent-only ads" phrasing), then Vercel deploy. Spec: `docs/superpowers/specs/2026-07-03-landing-page-design.md`.

## Key extraction rules (updated session 9)
- Entity-centric graph: entity-type hub → Brand hub → Item (vault paths: `item/zara/belt.md`, `place/monmouth-coffee.md`)
- 7 entity types: item, brand, place, person, event, org (employer/school/team, session 14), interest (subject/hobby/field followed, session 15 — tier1 empty, complete on naming) — each has tier 1/2/3 parameter stacks in entityTypes.ts. A skill/field the user knows is an interest or dropped, NOT an org. User self-facts (age, home_location) are NOT entities — they route to profiles.base_profile JSONB.
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
- Place containment (session 17): a `located_in` link_type nests places geographically (venue→city→country). Emitted smaller→larger ("Grand Club in Rzeszów"); unlike brand/relation it nests **source under target**. Extractor maps containment labels (in/located in/inside/within/part of) to `located_in`; the `in` relation may target an already-tracked home city/country even when not a fresh entity that window.

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
1. Landing page **polish** — page is built (session 16, `components/marketing/`); needs a visual pass (hero legibility, consent-toggle feel, copy) per user feedback
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
GEMINI_API_KEY=...        ← chat + extraction primary (Gemini 2.5 Flash)
CEREBRAS_API_KEY=...       ← fallback for both (gpt-oss-120b) if Gemini fails/rate-limits
ANTHROPIC_API_KEY=...     ← optional; only if extraction (lib/ai/synthesize.ts) is swapped from Cerebras to Anthropic Sonnet. Not required.
```

## File structure
```
apps/web/
├── app/
│   ├── page.tsx                    ← landing page (renders Landing; logged-in → /graph)
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── (app)/graph/page.tsx        ← home screen (server component, passes data to GraphWrapper)
│   ├── api/chat/route.ts           ← AI interviewer endpoint
│   └── api/vault/                  ← not built yet
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx         ← D3 graph (refreshTrigger prop, no polling)
│   │   └── GraphWrapper.tsx        ← client wrapper: shares refreshTrigger between canvas + chat
│   ├── marketing/                  ← landing page (Landing, DemoGraph, ConsentPanel, TalkDemo, GrowthTimeline, Nav, Reveal, graphData)
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

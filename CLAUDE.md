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

## What's been built (as of 2026-06-27, updated session 5)
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
- [x] /api/chat — Groq Llama 3.3 70B interviewer, vault context, known-facts, today's events, drill-down, brand rule, deflection, agenda injection
- [x] lib/ai/extract.ts — entity-centric extraction (Topic → Brand → Item or Topic → Entity), no You→Topic links, agenda update after each run
- [x] lib/ai/checklists.ts — required attributes per topic, Agenda type, CHECKLIST_PROMPT for system prompt
- [x] lib/ai/topics.ts — 31 topics
- [x] lib/ai/categories.ts — topic → subcategories map (still present, not used in graph routing)
- [x] Supabase: conversations.agenda JSONB — tracks current entity + pending threads across turns
- [x] Graph updates — event-driven (fires once 4s after each chat reply)
- [x] Supabase: reset_vault(user_id) function — idempotent vault wipe, re-seeds "You" root at _profile.md
- [x] Supabase: scheduled_for date column on vault_notes + partial index for today's event queries
- [x] HYPE_BUSINESS_ASSESSMENT.md — business memo: consent-based ad model, unit economics, next steps

## Claude Code plugins installed (user-scoped, active next session)
- `context-mode` — keeps large outputs out of context window (was pre-installed)
- `claude-code-setup` — run "recommend automations for this project" at session start
- `frontend-design` — auto-activates when building UI
- `ponytail` — prevents over-engineering, enforces minimum viable code

## START OF NEXT SESSION checklist
1. Run `git log --oneline -5` to confirm state
2. Run `cd apps/web && pnpm dev` to start the dev server
3. GROQ_API_KEY is already in apps/web/.env.local — chat is working
4. To reset vault for testing: `SELECT reset_vault('09158791-8006-453c-b176-98253e3ff1d8');` via Supabase MCP or SQL editor
5. Root "You" node is always at path `_profile.md`, topic `Profile` — extraction depends on this
6. `.mcp.json` is gitignored — Supabase MCP needs `SUPABASE_ACCESS_TOKEN` set locally in the file (not committed)

## Key extraction rules (session 5 decisions)
- Entity-centric graph: Topic → Brand → Item OR Topic → Entity (no category hub layer)
- "You" node is isolated — visual anchor only, no outgoing links from extraction
- Graph structure: topics float freely as independent clusters
- **Durability rule**: owned items, preferred brands, frequent places, recurring relationships
- **No inference**: never derive from implication
- **No pattern from single instance**: routine requires explicit frequency
- Places and people mentioned in passing ARE extracted (become pending agenda threads)
- Brand nodes: source="system", no required attributes
- Item/entity nodes: source="conversation", required attributes checked against checklists.ts

## Key interviewer rules (session 5 decisions)
- Agenda injected every turn: current entity + pending threads, AI blocked from topic changes until current is resolved
- Natural attribute grouping: color + material asked together ("What did it look like — color, material?")
- Value rule: never ask yes/no about an attribute — always ask for the specific value
- Drill-down for clothing: what it is → color + material (together) → size → price (only if mentioned)
- Deflection: accept, hard-pivot, never follow up on deflected topic
- Known-facts list injected to prevent re-asking

## What's NOT done yet (next steps in order)
1. **Graph + conversation flow refinements (session 5 left open)** — further improvements to graph representation and conversation agenda flow identified during testing; details to be discussed at session start
2. Landing page — marketing page at / (currently redirects to /signup); lead with "Be in control of your ads" + "Build your personal graph"
3. Vercel deployment
4. Affiliate link integration — Amazon Associates, Ticketmaster, Booking.com (Day 1 ad revenue, no advertiser deals needed)
5. Ad moment UI — sponsored offer card inside ChatPanel, clearly labeled, triggered only after user says yes
6. Mobile app (Expo) — only after web is live and validated

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
ANTHROPIC_API_KEY=...     ← planned for extraction synthesis (not yet needed)
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
│       ├── extract.ts              ← entity-centric extraction + agenda update
│       ├── checklists.ts           ← required attrs per topic, Agenda type, CHECKLIST_PROMPT
│       ├── topics.ts               ← 31 topics (source of truth)
│       └── categories.ts           ← topic → subcategories map (kept, not used in routing)
├── types/database.ts               ← all TypeScript types
└── supabase/schema.sql             ← full DB schema
```

## Owner
- Joshua Mendella (joshuaMendella on GitHub)
- Windows 11, no Mac — iOS builds via EAS Build
- New to git/GitHub — handle all git operations
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe (add to PATH in PowerShell: $env:PATH += ";C:\Program Files\GitHub CLI")

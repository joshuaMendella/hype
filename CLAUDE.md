# Hype — Claude Code Context

## What this project is
AI-powered personal knowledge graph. An AI interviewer learns about the user over time and builds an Obsidian-compatible vault of markdown notes. The graph visualization IS the home screen — users watch their knowledge graph grow as they talk to the AI.

## Business model (session 4 decision)
**Single source of truth: [BUSINESS.md](BUSINESS.md)** — core principles, lifecycle phases, current phase, and the document map. On any business-model conflict between docs, BUSINESS.md wins. Key principle to never violate in code: ad consent is **per-moment in chat** (assistant asks each time) — no toggles, no ad-settings page; `profiles.ad_preferences` is deprecated.

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
- **Mobile**: React Native + Expo (SDK 57) — core loop built + verified on-device (session 20); `apps/mobile`, shares `packages/shared` with web
- **Database**: Supabase (Postgres + Auth) — project ref: aykjvvtolkaqvijfeewn
- **AI**: Gemini 2.5 Flash (chat + extraction, primary) + Cerebras gpt-oss-120b (fallback). No Anthropic key needed.
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
3. Chat AND extraction both run on **Gemini 2.5 Flash primary** (GEMINI_API_KEY), with **Cerebras gpt-oss-120b as fallback** (CEREBRAS_API_KEY) if Gemini fails/rate-limits. Chat = `app/api/chat/route.ts` (`geminiChat`→`cerebrasChat`), **plain text — the route has no onboarding path anymore** (session 23 deleted `ONBOARDING_PROMPT`/`ONBOARDING_SCHEMA`/`isOnboarding`; `geminiChat(system, history)` takes no schema arg). Extraction = `lib/ai/synthesize.ts`, separate structured-output call. Both keys in .env.local; no Anthropic key needed. Web chat streams opt-in (`stream: true` → ndjson; content-type decides client-side); mobile/ad/scout-card paths stay plain JSON.
4. To reset everything for testing: `/hype-reset` (wipes vault, clears agenda, resets onboarding flag)
5. Root "You" node is always at path `_profile.md`, topic `Profile` — extraction depends on this
6. `.mcp.json` is gitignored — Supabase MCP needs `SUPABASE_ACCESS_TOKEN` set locally in the file (not committed)
7. **Scout digest (in-app welcome-back)** — built + verified, inert until keys. When a user returns after >48h, the opener can lead with one real local find (Ticketmaster city events; Bandsintown artist tours deferred until their API access) targeting `current_location` (fresh, 30-day TTL) else `home_location`. Built as a generalization of the ad-card flow. Needs `SCOUT_TICKETMASTER_KEY` in `.env.local`. Live test pending (owner mid-test with Giessen seeded). Plan: `docs/scout/2026-07-08-scout-digest-plan.md`.
8. **Extraction live-test open items:** narrow the item→place relation (intent items pick up a stray link to the mall, not just the stores); persona confirm-before-ending + farewell→reload→carryover loop.
9. **Landing page** built (`components/marketing/`, dark Revolut-style, consent-only-ads section); needs a visual-polish pass (hero legibility, consent-toggle feel, copy) then Vercel deploy. Spec: `docs/superpowers/specs/2026-07-03-landing-page-design.md`.
10. **Gardener (`lib/graph/reconcile.ts`)** — whole-graph batch cleanup, built + verified (session 21). Run on command: `NODE_OPTIONS="--conditions=react-server" pnpm dlx tsx scripts/reconcile.ts` (dry-run) / `--apply` to mutate (soft + logged + reversible via `archived_at`). **Pending:** owner-gated `POST /api/admin/reconcile` + admin-panel "Tidy graph" button (preview→apply); later a per-user daily cron. Plan: `docs/graph/2026-07-10-graph-refinement-and-gardener-plan.md`.
11. **Dated-event opener** — built + live-verified (session 21): a `scheduled_for` event surfaces in the interviewer's opener within a 14-day window, exactly once (`event_prompted_at`). Feeds the `current_location` freshness → You-link teardown. Plan: `docs/graph/2026-07-10-scheduled-events-and-location.md`.
12. **Session 22 traction quick wins — built, LIVE CHECKS PENDING:** vault-wide recall (top-20 full + titles index, `lib/ai/vaultContext.ts`), persona carve-outs (recall + shopping asks engage; tasks/code still deflect), opt-in ndjson streaming, You-node bloom, share-my-graph PNG. Owner live checks: streamed turn + reload persistence, 3 persona probes, fresh-vault bloom, share PNG, one mobile turn. Opener-card client drop fixed → scout live test (item 7) unblocked. Extraction now dedups against whole-vault titles — watch `refines` quality next live extraction test. Review: `docs/reviews/2026-07-11-traction-review.md`; plan: `docs/superpowers/plans/2026-07-11-traction-quick-wins.md`. Still to build before shipping (owner decision): push notifications + email reminders.
13. **Session 23 onboarding redesign — built, LIVE DRIVE PENDING:** new-user onboarding is a **deterministic 7-beat flow inside `ChatPanel`** (onboarding mode gated on `onboarded === false`), no conversational LLM for beats 1–6. Beats: welcome → the-dot/how-to → value+consent (translucent `ExampleConsentCard`, ghosted Yes/Not now, revealed *after* the line prints + trailing consent line) → ask location (seeds a `place` node + `base_profile.home_location`) → ask work/study (seeds `org` OR `interest`) → confirm → **handoff:** flips `onboarded=true` client-side then replays the Q&A to `/api/chat` so the real interviewer produces a context-aware beat 7. **Node seeding (session 23 improvement) moved to `POST /api/onboarding/seed`** — a small server-side structured Gemini call (`lib/onboarding/classify.ts`, temp 0, `{title, entity_type, confidence}`) with the regex helpers in `lib/onboarding/titles.ts` as fallback; fixes the old hard-coded `org` type and clumsy titles. One in-voice retry for vague work answers (nothing seeded until confident/forced). Copy + per-beat input placeholders in `lib/onboarding/script.ts`; `seed.ts` now only holds client `completeOnboarding`. Both You-edges are GraphCanvas synthetic `self` links (place needs its title in live `identityPlaces` state, lifted into `GraphWrapper`; org/interest auto-link). **This work also deleted the LLM onboarding path from `route.ts` — the permanent fix for the Gemini degeneration bug** (see [[project_gemini_degeneration]]). Owner live drive: `/hype-reset` → walk all 7 beats, confirm two nodes pop + link to You, confirm `onboarded=true` persists on reload. Known edge (minor, self-recovers): ~900ms window on the confirm beat where a stray Enter briefly blanks the line before the handoff timer replaces it. Copy is owner-refinement-pending (a better draft coming). Specs/plans: `docs/superpowers/specs/2026-07-12-onboarding-redesign-design.md`, `docs/superpowers/plans/2026-07-12-onboarding-redesign.md` + `docs/superpowers/plans/2026-07-12-onboarding-improvements.md`.

## Extraction & interviewer rules
The detailed extraction rules (entity types, tiers, gravity agenda, containment) and interviewer rules (agenda injection, attribute grouping, deflection, session-end) live in **[docs/engineering-canon.md](docs/engineering-canon.md)** — moved out of this file to keep session context lean. Read that doc before extraction or persona work.

## What's NOT done yet (next steps in order)
1. Landing page **polish** — page is built (session 16, `components/marketing/`); needs a visual pass (hero legibility, consent-toggle feel, copy) per user feedback
2. Vercel deployment — **pre-deploy blocker**: wire the "Delete account" row (currently a disabled placeholder in UserMenu) to real GDPR deletion + add privacy/legal copy. User menu itself is built (session 19: Profile+Gender, Graph settings, Manage nodes, Export, Logout).
3. Scout digest — v1 built (see checklist #7); add Bandsintown when API access lands, interest APIs (TMDB/RAWG/etc.) later
4. Affiliate link integration — Amazon Associates, Ticketmaster, Booking.com (Day 1 ad revenue, no advertiser deals needed)
5. Ad moment UI — the offer card is built and generalized (`AdCard` = `kind: "ad" | "scout"`); still need real sponsor sourcing + the yes-gated ad path wired
6. Mobile app (Expo) — core loop built + verified on a physical Android device (session 20: login → live Skia graph → chat → nodes grow). **Next: polish punch list** (owner has a "points to improve" list, captured next session), then Phase 8 standalone preview APK (needs `EXPO_PUBLIC_*` as EAS env + a deployed web URL). Full build log + resume marker: `docs/mobile/2026-07-06-mobile-app-plan.md`.

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
SCOUT_TICKETMASTER_KEY=... ← scout digest city events (server-only, no NEXT_PUBLIC_); absent = scout silently off
SCOUT_BANDSINTOWN_APP_ID=...← scout artist tours (server-only); deferred until Bandsintown API access
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
│   └── api/vault/export/route.ts   ← vault → hype-vault.zip (jszip, RLS user client)
├── components/
│   ├── graph/
│   │   ├── GraphCanvas.tsx         ← D3 graph (refreshTrigger + settings props; colors via lib/graph/palettes)
│   │   └── GraphWrapper.tsx        ← client wrapper: shares refreshTrigger + graph settings across canvas/chat/menu
│   ├── marketing/                  ← landing page (Landing, DemoGraph, ConsentPanel, TalkDemo, GrowthTimeline, Nav, Reveal, graphData)
│   ├── menu/UserMenu.tsx           ← avatar chip → slide-over drawer: Profile, Graph settings, Manage nodes, Export, Logout
│   └── chat/
│       ├── ChatPanel.tsx           ← AI chat overlay (onReply; reads ndjson streams, typewriter for JSON). Also owns the deterministic onboarding mode (ObStep state machine, beats 1–6 client-side → handoff to /api/chat for beat 7)
│       ├── ExampleConsentCard.tsx  ← static translucent sample-ask card (ghosted Yes/Not now) shown on the onboarding consent beat — NOT the real ad card
│       └── AdCard.tsx              ← offer card, kind: "ad" | "scout" (scout = "Local find")
├── lib/
│   ├── supabase/client.ts          ← browser client
│   ├── supabase/server.ts          ← SSR client
│   ├── supabase/admin.ts           ← service role (server-only)
│   ├── graph/palettes.ts           ← node-color source of truth: topic map + 4 palette modes + backgrounds + localStorage settings
│   ├── graph/shareImage.ts         ← share-my-graph: SVG → 2x PNG (wordmark) → native share sheet or download
│   ├── graph/reconcile.ts          ← Gardener: whole-graph batch cleanup (merge/retype/add_edge/drop), dry-run default, soft-delete via archived_at (run: scripts/reconcile.ts, --apply to mutate)
│   ├── profile/currentLocation.ts  ← shared 30-day current_location TTL (isCurrentLocationFresh) — used by scout + graph You-linking
│   ├── onboarding/                 ← deterministic new-user flow: script.ts (beat copy + per-beat placeholders), titles.ts (pure toSlug/stripLeadIn/workNodeTitle/isVagueWork fallbacks — check: scripts/check-onboarding-seed.ts), classify.ts (server structured Gemini call → {title,entity_type,confidence}), seed.ts (client completeOnboarding only). Node writes go through POST /api/onboarding/seed
│   ├── scout/                      ← scout digest: sources.ts (Ticketmaster/Bandsintown), getScoutFind.ts (48h gate + city cache, admin-only)
│   └── ai/
│       ├── synthesize.ts           ← extraction pass, Gemini 2.5 Flash primary + Cerebras fallback (strict json_schema) — feeds extractFacts; runs async off the chat turn
│       ├── vaultContext.ts         ← interviewer vault window: top-20 relevant notes full + titles-only index of the rest (check: scripts/check-vault-context.ts)
│       ├── extract.ts              ← extractFacts: agenda gravity + vault writes (now fed by synthesize.ts, no longer LLM-coupled)
│       ├── entityTypes.ts          ← 7 entity types with tier 1/2/3 parameter stacks (source of truth for extraction)
│       ├── checklists.ts           ← AgendaItem/Agenda types, CHECKLIST_PROMPT (tiered)
│       ├── topics.ts               ← 31 topics (used for tags + graph display, not extraction classification)
│       └── categories.ts           ← topic → subcategories map (kept, not used in routing)
├── types/database.ts               ← all TypeScript types
└── supabase/schema.sql             ← full DB schema (incl. scout_cache: RLS-enabled, no policies = admin-client-only)
```

## Owner
- Joshua Mendella (joshuaMendella on GitHub)
- Windows 11, no Mac — iOS builds via EAS Build
- New to git/GitHub — handle all git operations
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe (add to PATH in PowerShell: $env:PATH += ";C:\Program Files\GitHub CLI")

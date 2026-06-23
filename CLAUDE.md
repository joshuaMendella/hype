# Hype — Claude Code Context

## What this project is
AI-powered personal knowledge graph. An AI interviewer learns about the user over time and builds an Obsidian-compatible vault of markdown notes. The graph visualization IS the home screen — users watch their knowledge graph grow as they talk to the AI.

## Repo
- GitHub: https://github.com/joshuaMendella/hype
- Local: C:\Users\mende\desktop\hype
- Monorepo: Turborepo + pnpm workspaces

## Stack
- **Web**: Next.js 16 + TypeScript + Tailwind CSS (apps/web)
- **Mobile**: React Native + Expo — not started yet (apps/mobile)
- **Database**: Supabase (Postgres + Auth) — project ref: aykjvvtolkaqvijfeewn
- **AI**: Anthropic Claude API — Haiku for chat, Sonnet for synthesis
- **Graph**: D3 force simulation (custom, no react-force-graph)
- **Deploy**: Vercel (not yet configured)

## Key architectural decisions
- Dual-layer: Postgres = primary source of truth, Markdown vault = AI/human-readable memory layer
- Every vault note = one graph node; every [[wikilink]] = one graph edge
- Service role key is NEVER used client-side — only in API routes
- RLS enabled on all tables — users can only access their own data
- Three Supabase clients: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (SSR), `lib/supabase/admin.ts` (server-only, bypasses RLS)

## What's been built (as of 2026-06-23)
- [x] Monorepo scaffold (Turborepo, pnpm, TypeScript)
- [x] Next.js app scaffolded in apps/web
- [x] Supabase schema: profiles, vault_notes, vault_links, conversations, messages, extractions
- [x] RLS policies + triggers (auto-create profile + root vault note on signup)
- [x] Auth middleware (protects /graph, redirects unauthenticated)
- [x] Login + Signup pages (/login, /signup)
- [x] Graph page (/graph) — full-screen D3 force graph + chat panel overlay
- [x] GraphCanvas component — Obsidian-style, topic colors, zoom/pan/drag, tooltips
- [x] ChatPanel component — collapsible bottom-right overlay
- [x] /api/chat — Claude Haiku interviewer, persists messages to DB

## Claude Code plugins installed (user-scoped, active next session)
- `context-mode` — keeps large outputs out of context window (was pre-installed)
- `claude-code-setup` — run "recommend automations for this project" at session start
- `frontend-design` — auto-activates when building UI
- `ponytail` — prevents over-engineering, enforces minimum viable code

## START OF NEXT SESSION checklist
1. Run `git log --oneline -5` to confirm state
2. Run "recommend automations for this project" to let claude-code-setup analyse the stack
3. Joshua to test the app first: add ANTHROPIC_API_KEY to apps/web/.env.local, run `cd apps/web && pnpm dev`

## What's NOT done yet (next steps in order)
1. ANTHROPIC_API_KEY — Joshua needs to add to apps/web/.env.local before AI works
2. Run claude-code-setup analysis — will recommend MCP servers, hooks, subagents
3. Extraction pipeline — after AI conversation, extract facts → write vault notes → update graph in real time
4. Vault API route — POST /api/vault to create/update notes and links
5. Real-time graph updates — Supabase Realtime subscription in GraphCanvas
6. Landing page — marketing page at / (currently redirects to /signup)
7. Vercel deployment

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
- `SUPABASE_SERVICE_ROLE_KEY` has no `NEXT_PUBLIC_` prefix — server-only
- `ANTHROPIC_API_KEY` has no `NEXT_PUBLIC_` prefix — server-only
- Admin client (`lib/supabase/admin.ts`) must only be imported in `app/api/` routes

## Environment variables needed
```
NEXT_PUBLIC_SUPABASE_URL=https://aykjvvtolkaqvijfeewn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...  ← still needs to be added
```

## File structure
```
apps/web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/signup/page.tsx
│   ├── (app)/graph/page.tsx     ← home screen
│   ├── api/chat/route.ts        ← AI interviewer endpoint
│   └── api/vault/               ← not built yet
├── components/
│   ├── graph/GraphCanvas.tsx    ← D3 graph
│   └── chat/ChatPanel.tsx       ← AI chat overlay
├── lib/
│   ├── supabase/client.ts       ← browser client
│   ├── supabase/server.ts       ← SSR client
│   ├── supabase/admin.ts        ← service role (server-only)
│   ├── ai/                      ← not built yet
│   └── vault/                   ← not built yet
├── types/database.ts            ← all TypeScript types
└── supabase/schema.sql          ← full DB schema
```

## Owner
- Joshua Mendella (joshuaMendella on GitHub)
- Windows 11, no Mac — iOS builds via EAS Build
- New to git/GitHub — handle all git operations
- gh CLI path: C:\Program Files\GitHub CLI\gh.exe (add to PATH in PowerShell: $env:PATH += ";C:\Program Files\GitHub CLI")

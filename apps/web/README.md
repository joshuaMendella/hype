Hype web app — Next.js 16 + TypeScript + Tailwind + Supabase. Part of the Hype Turborepo monorepo.

## Setup

From the repo root:

```bash
pnpm install
cd apps/web && pnpm dev
```

Dev server runs at http://localhost:3000.

Env vars live in `apps/web/.env.local` (gitignored) and are documented in the root `CLAUDE.md`.

## Architecture

See the root [`CLAUDE.md`](../../CLAUDE.md) for full context — stack, file structure, and the extraction pipeline.

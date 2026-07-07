# Full Project Review — 2026-07-03

Veteran-entrepreneur/developer review of Hype (code + business). Status column tracks what's been addressed — update it as items land.

## TL;DR

The engineering core is genuinely good — the two-pass architecture (plain-text chat + separate structured extraction), the agenda gravity system, and the RLS setup are all cleaner than most seed-stage codebases. The three biggest gaps are **product-side, not code-side**: (1) the revenue loop is half-built — intents get banked but nothing ever consumes them, so the business model is still 0% validated; (2) the user has zero control over their own data, which directly contradicts the "be in control" pitch; (3) a page reload silently amnesia-wipes the AI mid-conversation. Plus one operational hole: the chat API has no rate limiting or size caps, so a single free account can burn the LLM quota at will.

## Business / product findings

### 1. The revenue flywheel has no exit — highest priority after polish
`extract.ts` records intents with confidence, category, and a 30-day TTL, but nothing reads the `intents` table. No affiliate link builder, no ad-moment card, no "want me to find deals?" surface. Until one user clicks one affiliate link, the CPC/CPA model is a hypothesis. Cheapest validation: when the interviewer detects an open intent and the user says yes to "want me to keep an eye out for deals?", show a labeled offer card with an Amazon Associates search URL (`amazon.com/s?k={category}&tag={yourtag}`). ~A day of work; turns the data layer into a testable business.

### 2. No user control over the vault — undercuts the core differentiator
The pitch is consent and control, but a user cannot view a note's full content, correct a wrong fact, delete a node ("forget this"), or export their vault — despite "Obsidian-compatible vault" being the product definition (`app/api/vault/` is an empty directory). Needed:
- Click-to-open node panel with edit/delete
- `/api/vault/export` endpoint that zips the markdown
This is also the GDPR story (rectification, erasure, portability). Storing age, home city, relationships → before Vercel deploy: privacy policy page + account deletion, minimum. Not optional for an EU-facing consent-ads product.

### 3. Retention loop is undefined
The interviewer collects well, but the product gives nothing back besides watching dots appear. What brings someone back on day 3? Cheap utility win: the vault stores `scheduled_for` events — surface "you mentioned X is next week", or let users query their own vault ("what was that coffee place I mentioned?"). Recall is the first genuinely selfish reason to keep feeding it.

### 4. ~~Consent capture doesn't exist yet~~ — SUPERSEDED (2026-07-05)
> **Superseded by decision in `BUSINESS.md` principle 2:** consent is per-moment and conversational — the assistant asks before every ad, in chat. There is no toggle and no ad-settings page, by design. `profiles.ad_preferences` is deprecated (unused; drop in a future migration). The original text recommended a toggle; do not build one.

## Code / security findings

### 5. Chat history is lost on reload (user-facing bug)
`ChatPanel` mounts with `messages: []` every time. The server correctly reuses the active conversation (< 2h) and keeps the agenda, but the LLM receives an empty history and generates a fresh opener — mid-conversation, the AI visibly forgets the last exchanges even though they're in the `messages` table. Fix: on mount, load the active conversation's messages (server component already has a Supabase client) and seed the panel.

### 6. `/api/chat` has no abuse limits (cost/DoS exposure)
Any authenticated user can send unlimited requests, unbounded message length, and the *entire* client-supplied history goes to Gemini every turn (extraction windows to 8 turns; chat does not). Fix with three small changes, **before Vercel deploy**:
- Cap message length (~2,000 chars → 400 response)
- Send only the last ~30 turns to the model
- Daily per-user quota via a count on the `messages` table

### 7. `send()` in ChatPanel has `try/finally` but no `catch`
Network failure → unhandled rejection; UI re-shows the previous AI message with no error. Add a catch that sets the "something slipped" message.

### 8. Enforce the admin-client rule at build time
`admin.ts` is server-only by convention but imported via `lib/ai/extract.ts` — one accidental client import from leaking. Add `import "server-only"` at the top of `admin.ts` (Next.js fails the build on any client import path). One line, permanent guarantee.

### 9. Dead dependencies + stale docs
- `groq-sdk` and `@anthropic-ai/sdk` are imported nowhere (both providers called via `fetch`). Remove from `apps/web/package.json`.
- CLAUDE.md env-vars section still documents `GROQ_API_KEY` as the chat key — should say `GEMINI_API_KEY` + `CEREBRAS_API_KEY`.

### 10. Smaller items
- `vault_links` `UNIQUE(source, target)`: a `located_in` edge is silently dropped if a `brand`/`relation` edge already exists between the same pair; A→B vs B→A duplicates allowed. Will bite when the graph densifies.
- Graph refresh polls at 3s/6.5s after each reply — extraction slower than 6.5s never appears until reload. Supabase Realtime on `vault_notes` is the clean upgrade.
- Missing index on `vault_notes(user_id, scheduled_for)` — trivial, queried every chat turn.
- Cerebras onboarding fallback has no JSON schema; if Gemini is down during onboarding, `onboarding_complete` depends on the regex rescue. Known, acceptable.

## Suggested order of attack

| # | Item | Status |
|---|------|--------|
| 1 | Landing polish + rate limits (#6) + `server-only` (#8) + dead deps (#9) — pre-deploy hygiene | ☐ |
| 2 | Chat history restore (#5) — worst visible bug | ☐ |
| 3 | Node detail panel with edit/delete + vault export (#2) — delivers the control promise | ☐ |
| 4 | Affiliate ad-moment card (#1) — first revenue signal | ☐ |
| 5 | Privacy policy + account deletion — before any real users | ☐ |

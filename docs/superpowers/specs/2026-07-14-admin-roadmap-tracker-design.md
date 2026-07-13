# Admin Roadmap Tracker — Design

**Date:** 2026-07-14
**Status:** Approved pending owner spec review

## What

A read-only "Roadmap" view inside the existing owner-gated admin panel (`/admin`) that tracks every area of the platform from idea to launch-ready: what exists, what stage it's in, and the core principle governing each area.

## Why

The build state currently lives scattered across CLAUDE.md, CHANGELOG.md, and a dozen plan docs. The owner needs one screen answering: what's done, what's built-but-unverified, what's next, and what blocks launch.

## Data

One checked-in file: `apps/web/lib/admin/roadmap.ts`. No database, no edit UI — Claude updates the file as part of each session's work (same discipline as CLAUDE.md). Versioned in git; the view is always a render of the repo's own claim about itself.

```ts
type ItemStatus = "done" | "built-unverified" | "in-progress" | "planned" | "blocked"

type RoadmapItem = {
  title: string
  status: ItemStatus
  note?: string          // one line of context (e.g. "live check pending — Giessen seeded")
  doc?: string           // repo-relative path to the spec/plan
  launchBlocker?: boolean
}

type RoadmapArea = {
  name: string
  principle: string      // 2–3 sentences: the core principle behind this area
  items: RoadmapItem[]
}

export const ROADMAP: RoadmapArea[] = [ ... ]
```

`built-unverified` exists because it is this project's most common state: code merged, owner live check pending.

## Areas (seeded at build time from CLAUDE.md / CHANGELOG / docs; owner corrects)

Each ships with a `principle` drawn from BUSINESS.md, engineering-canon, and CLAUDE.md:

1. **Onboarding** — deterministic 7-beat client flow (no LLM beats 1–6), transparent data contract up front, consent shown per-moment style from the first minute; seeds two real nodes before handoff to the interviewer.
2. **Interviewer (chat)** — an AI that remembers you: Gemini 2.5 Flash primary + Cerebras fallback, vault-wide recall, persona stays an interviewer (deflects tasks/code, engages recall + shopping), dated-event and scout openers.
3. **Extraction & vault** — dual-layer memory: Postgres is truth, the Obsidian-compatible markdown vault is the AI/human-readable layer; every note = node, every wikilink = edge; tiered entity types + gravity agenda; runs async off the chat turn.
4. **Graph & visualization** — the graph IS the home screen; users watch it grow as they talk. D3 force sim, You-node root at `_profile.md`, palettes, bloom, share-PNG; Gardener batch cleanup keeps it tidy.
5. **Node structure principles** — categories fixed, brands cross-linked, attributes live in `content_md` not as nodes; containment and tier rules from engineering-canon; item→place relation kept narrow.
6. **Finds (offers & revenue)** — finds are a core product value, not a monetization story; consent is per-moment in chat (assistant asks each time — never a toggle or settings page); lexicon is find/offer/suggestion, never "ad"; affiliates day one, direct deals later.
7. **Mobile app** — same backend, thinner shell: Expo + Skia graph reusing `packages/shared` and bearer-JWT `/api/chat`; core loop verified on device; polish then preview APK.
8. **Landing page** — Portal-style 11-block page, lexicon-clean, waitlist-first; sells "it remembers you" + finds as value, free is a footnote.
9. **Marketing & socials** — items seeded as `planned` placeholders (X/Twitter, TikTok/Reels short-form of the growing graph, Product Hunt, waitlist nurture); principle drafted from BUSINESS.md positioning; owner owns this list.
10. **Launch ops** — everything between code-complete and public: GDPR delete-account wiring, privacy/legal copy, Vercel deploy, env/keys, push notifications + email reminders, revenue validation plan.

Item statuses seeded from checklist items 7–13 of CLAUDE.md and the "not done yet" list (e.g. Delete-account wiring = `blocked` + `launchBlocker`, scout live test = `built-unverified`, affiliate links = `planned`).

## View

New route: `apps/web/app/(admin)/admin/roadmap/page.tsx` — server component, no client JS.

- **Owner gate:** same defense-in-depth re-check as the dashboard page (layout gates, page re-checks before render). No admin-client reads needed here (data is a static import), but keep the auth re-check so the route never renders for a non-owner even if the layout changes.
- **Nav:** small link strip (Dashboard · Roadmap) added to the admin layout, matching existing dark styling.
- **Header strip:** overall counts by status + a "Launch blockers" list of items flagged `launchBlocker: true`.
- **Body:** one card per area — area name, `done/total` count, the principle paragraph in muted text, then item rows: colored status chip, title, note, doc path (plain text, not a link — docs aren't served).
- Status chip colors: done = green, built-unverified = amber, in-progress = blue, planned = neutral, blocked = red.

## Not building (YAGNI)

- No filtering, search, history, drag-reorder, or percent-complete visuals — add if the list outgrows one screen.
- No DB table or edit UI — the repo file is the single source of truth.
- No automation syncing CLAUDE.md ↔ roadmap.ts — Claude keeps both current manually per session.

## Testing

- `pnpm build` passes.
- One tiny data sanity check (script or inline assert): every area has a non-empty `principle` and ≥1 item, statuses are valid — fails loud at build/dev if the file rots.
- Manual: owner loads `/admin/roadmap`, sees all areas; logged-out / non-owner gets 404.

## Execution

Per owner workflow: this spec + plan authored by Fable; implementation dispatched to Sonnet subagent(s).

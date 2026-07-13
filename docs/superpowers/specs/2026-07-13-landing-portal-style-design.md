# Landing Page — Portal-Style Rebuild (Design Spec)

**Date:** 2026-07-13
**Status:** Approved design, pending implementation plan
**Supersedes:** `2026-07-03-landing-page-design.md` (the dark Revolut-style page) and the reverted 2026-07-13 fresh-build attempt (`0e3089d`, reverted in `23f1e22`).

## 1. Goal

Replace the current landing page with a long-form, Portal-style (useportal.net) page whose single job is **recruiting 15–20 closed-beta testers** (BUSINESS.md Phase 1). The page explains the app in real detail — Portal's storytelling depth — with a captivating, original look. Primary conversion: **email waitlist** (not direct signup; the owner curates the tester cohort).

Reference: Portal's landing page (screenshot reviewed 2026-07-13). **The page mirrors Portal's structure exactly, block for block** (11 blocks, §4).

## 2. Decisions made (with owner)

| Decision | Choice |
|---|---|
| Visual base | **Night-sky hybrid**: dusk-gradient hero where the knowledge graph is the constellation → warm light "daylight" sections for the storytelling → night sky returns at the footer. Dusk → day → night arc. |
| CTA | **Email waitlist** (new `waitlist` table + `POST /api/waitlist` + one form component). No direct-signup CTA. |
| Founder memo | **Included.** Claude drafts the letter in Joshua's voice; Joshua rewrites/approves before deploy. |
| Build approach | **Fresh build alongside** (approach A): new components built next to the old ones; old files deleted only at the end. The build never goes red (the mistake of the reverted attempt). |
| Structure | **Exact 1:1 with Portal's 11 blocks** — no merging or reordering. |
| Execution | Sonnet subagents implement; Fable/Opus plans and reviews (owner's model-split workflow). |

## 3. Visual system

- **The arc tells time.** Hero: deep-indigo → violet → warm-amber-horizon dusk gradient; graph nodes render as glowing stars, wikilink edges as faint constellation lines. Sections below: warm paper-white daylight (Portal's airiness). Footer: full night, star field, waitlist form under the constellation. The product needs no device frame in the sky — the graph *is* the sky — but the hero also carries a real app-screenshot card (§4 block 2) to match Portal exactly.
- **Accents come from the product.** Light-section accent colors (icon grid, kickers, step numbers) use the real topic colors from `lib/graph/palettes.ts` (`nodeColorFor`, `vibrant` mode) — the marketing visual system is literally the graph's.
- **Typography:** existing font vars (`font-display` for headlines). No new fonts.
- **Motion:** existing `Reveal.tsx` for scroll-in; D3 (already installed) for the live constellation. No new dependencies.
- **Reused as-is or re-skinned:** `Reveal.tsx`, `graphData.ts` (`DEMO_NODES`/`DEMO_LINKS`), `DemoGraph.tsx`'s D3 force simulation (re-skinned as star-graph).

## 4. Section map — exact Portal mirror

| # | Portal block | Hype block |
|---|---|---|
| 1 | Nav: logo · links · CTA | Hype wordmark · anchor links (How it works · The deal) · **Join the waitlist** button |
| 2 | Hero: starry gradient sky, 2-line headline, subhead, CTA, app screenshot overlapping the horizon | Dusk sky, live D3 constellation as the star field; 2-line headline; subhead; waitlist form/CTA; **real app-screenshot card** (graph home + chat) sitting on the horizon line. Screenshot slot ships as a styled placeholder frame; real capture from the owner's dev instance dropped in before deploy. |
| 3 | Big statement #1 + two body paragraphs | The core promise: you've told a hundred apps who you are — Hype listens once and never forgets. Two short paragraphs: talk naturally, watch a living map of your world grow; every fact visible, correctable, deletable. |
| 4 | Icon feature grid: 8 colorful items + hand-drawn annotation | 8 topic-colored icons: talk naturally · watch your graph grow · perfect recall · it looks ahead · reflection · finds you'd actually want · own every fact · take it anywhere (Obsidian export). Small hand-drawn-style annotation like Portal's. |
| 5 | Statement #2 + **4 alternating image/text rows** | Statement + 4 rows: **The interview** (chat snippets → nodes appearing) · **The graph & vault** (plain markdown, Obsidian-compatible, edit/delete anything) · **It gives back** (recall: "what was that coffee place in Lisbon?"; proactive: "your sister's birthday is next week"; reflection: "a year ago you were into X — still?") · **Finds** (the consent moment: Hype asks, you say yes or no, one "Sponsored · you said yes" card). |
| 6 | Statement #3 + **2×2 feature grid** + wide bottom card | Pain-point flip: **"Stop being the product."** 2×2: every fact visible · correct or delete anything · export to plain markdown · it asks before every find. Wide card: the graph *is* the privacy policy. |
| 7 | Statement #4 + screenshot carousel | **"A graph that looks like you."** Carousel/collage of graph shots in the 4 palette modes (`PALETTE_MODES`) + the share-my-graph PNG. Beauty/identity section. |
| 8 | Numbered steps 1–6 | The journey: 1 join the beta → 2 two-minute onboarding → 3 talk, watch it bloom → 4 it starts giving back → 5 a find, only when you say yes → 6 yours forever, export anytime. |
| 9 | "Pricing? Glad you asked." straight-talk box | **"What's the catch? Glad you asked."** Hype is free. When you say yes to a find and it leads somewhere, the brand pays for the referral. They get a click — never your data; your profile never leaves Hype. Free is stated as a consequence of the model, never the pitch. |
| 10 | Founder memo, signed | Joshua's letter: why a solo founder is building this, what beta testers get. Signed "Joshua, founder of Hype". Draft by Claude, rewrite by owner. |
| 11 | Footer CTA + links + illustrated landscape | Night sky returns: "Be one of the first." + waitlist form + minimal footer links (Contact · GitHub as applicable) + constellation horizon at the very bottom. |

## 5. Copy rules (from BUSINESS.md canon — absolute)

- Lexicon: **"find," "offer," "suggestion" — never "ad(s)"** anywhere on the page.
- **No "free because…" framing.** Finds are sold as a core value alongside "it remembers you"; free is a footnote (block 9 states the model straight without excusing it).
- Working line available: *"Only what you want, when you want it."*
- Consent is per-moment: copy must never imply toggles or an ad-settings page.
- Paid finds carry a "Sponsored" label — shown honestly in the block-5 finds row.

## 6. Waitlist backend (minimal)

- Table `waitlist`: `id uuid pk default`, `email text unique not null`, `created_at timestamptz default now()`. **RLS enabled, no policies** — admin-client-only, same pattern as `scout_cache`. Added to `supabase/schema.sql` + applied as a migration.
- `POST /api/waitlist`: validates email format, inserts via `lib/supabase/admin.ts` with on-conflict-do-nothing (duplicates return success). No auth required. Basic input-length guard.
- `WaitlistForm` client component (email field + button → "You're on the list ✓" state), used in blocks 2 and 11.

## 7. Files

- **New:** `components/marketing/` section components (one file per block or sensible grouping), `WaitlistForm.tsx`, `app/api/waitlist/route.ts`, `waitlist` table in `supabase/schema.sql`, hero/night token additions in `globals.css`.
- **Kept:** `Reveal.tsx`, `graphData.ts`, `DemoGraph.tsx` (re-skinned or forked as constellation), `Nav.tsx` only if trivially restyled — otherwise replaced.
- **Deleted last:** `ConsentPanel.tsx`, `TalkDemo.tsx`, `GrowthTimeline.tsx`, `PhoneMock.tsx`, `Thread.tsx`, `ThemeToggle.tsx`, old `Landing.tsx` content (file is replaced, not removed — `app/page.tsx` keeps importing it).
- **Build-order constraint:** new page assembled behind the same `Landing.tsx` export; old components removed only after the new page renders. `pnpm build` green at every commit.

## 8. Out of scope

- Custom illustrations / mascot art (the constellation carries the originality; an illustrator can come later).
- Blog, product-page nav links (nothing behind them).
- Analytics wiring and Vercel deploy (separate task; deploy still blocked on GDPR delete-account per CLAUDE.md).
- Direct-signup path from the page (waitlist only, by decision).
- Light/dark theme toggle (page owns its own dusk→day→night palette; `ThemeToggle` is deleted).

## 9. Owner inputs needed before deploy

1. Rewrite/approve the founder-memo draft.
2. A real screenshot of the graph home screen (hero, block 2) — captured from the dev instance.
3. Copy review of headline + block statements (owner flagged copy refinement pending in the onboarding work too; same review pass can cover this).

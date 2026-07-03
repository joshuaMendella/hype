# Hype Landing Page — Design Spec

**Date:** 2026-07-03
**Status:** Approved for planning
**Route:** `/` (apps/web/app/page.tsx) — currently a placeholder redirect to `/signup`

## Goal

A modern, cinematic marketing page for logged-out visitors that converts them to sign up.
Positioning: **Hype is a personal AI assistant that knows you — and is radically honest about
your data.** Not an ad platform that happens to be useful.

Visual direction: **Revolut** — dark, engineered, motion-forward, each section one idea + one
big visual, glowing CTAs, generous vertical rhythm. Warm, plain-spoken copy (not cold
fintech-speak). Seamless into the app's dark graph screen (`#0d0d0d`).

Logged-in users still bypass this page (redirect to `/graph`). Logged-out users see the page.

## The three value stories (and where each lives)

1. **The living graph** (the magic) → the **hero**. Most distinctive, screenshot-worthy thing.
2. **Second brain** (research your past, track progress) → a dedicated section. The retention story.
3. **Awareness & consent** (the honest data deal) → a proud, prominent trust section — reframed
   from "control your ads" to "you see everything it knows; nothing happens without your yes."

## Visual system

- **Base:** near-black `#0a0a0a` → transitions seamlessly into the app's `#0d0d0d` graph screen.
- **Accent axis:** reuse the app's real `TOPIC_COLORS` palette (GraphCanvas.tsx). Each feature
  section gets a topic-derived accent gradient, so the landing page is literally colored by the
  same system that colors the graph. This is the one distinctive, product-grounded aesthetic thread.
  - Hero / CTA band: white glow (`#ffffff` — the Profile "You" color)
  - §2 "Just talk": topic blue (`#60a5fa`, Work)
  - §3 "Second brain": topic green (`#4ade80`, Health)
  - §4 "Awareness & consent": topic amber (`#fbbf24`, Home)
- **Typography:** `next/font/google`, self-hosted at build (no runtime CDN — matches security posture).
  - Display / headlines: **Space Grotesk** (tight, engineered). Swappable — Archivo / Bricolage
    Grotesque are fallbacks if a different grotesk is preferred.
  - Body: **Inter**. Poppins stays loaded for the app; not used on the landing page.
- **Surfaces:** rounded cards (`rounded-2xl`+), subtle glass (`bg-white/[0.02]`, hairline borders
  `border-white/10`), soft glows via radial gradients and `blur`.
- **Motion (restrained):**
  - Hero graph animates on load (nodes drift/settle/glow).
  - Each section rises + fades in on scroll (IntersectionObserver, one-shot).
  - Node "birth" pulse in the hero and §2 demo.
  - No parallax zoo, no scattered effects — one orchestrated moment per section.
- **Accessibility:** respect `prefers-reduced-motion` (freeze the graph to a static settled state,
  disable scroll-reveal). Real focus rings on nav + CTAs. Semantic headings.

## Section-by-section

### Nav (sticky, backdrop-blur)
- Left: **Hype** wordmark.
- Right: `Sign in` (ghost) · **`Start your graph`** (glowing primary → `/signup`).
- Transparent over hero; gains a faint `bg-black/60` blur after slight scroll.

### 1 — Hero
- Eyebrow: `YOUR PERSONAL AI ASSISTANT` (uppercase, tracked, dim).
- Headline (display): **"An assistant that learns you by heart."**
  - Alt copy to A/B later: "Meet the assistant that actually knows you." / "Your mind, mapped."
- Subcopy (body, one line): "Talk to Hype like a friend. It builds a living map of your world —
  the people, places, and things that make you *you* — and remembers all of it."
- CTAs: **`Start your graph`** (primary) · `See how it works` (ghost, scrolls to §2).
- **Visual — the live graph (the signature moment):** reuse the real `GraphCanvas` rendering an
  **ambient demo graph** (~12–18 hard-coded demo nodes/links, seeded, no Supabase). Nodes drift
  via the existing force sim, glow, and grow in on load. This IS the product on the landing page.
  - Component: `components/marketing/HeroGraph.tsx` (client). Feeds GraphCanvas static demo data,
    disables interaction chrome not wanted on a hero (tooltips optional/off), caps motion.
  - Perf: single canvas, `requestAnimationFrame` already in GraphCanvas; cap node count; stop the
    sim after it settles (or slow ambient drift) to avoid a pinned CPU. `prefers-reduced-motion`
    → render one settled frame, no loop.
- Radial vignette (`radial-gradient(...transparent…#0a0a0a)`) fades graph edges into the page.

### 2 — "Just talk. It does the rest."
- One idea: no forms — you have a conversation, and the graph builds itself.
- Visual: a **split scene** — an assistant chat bubble asking a question on one side; on the other,
  a node materializes + links in (scroll-triggered birth animation). Reuses the node-birth visual
  language from GraphCanvas.
- Body: "No setup, no forms, no tags to manage. You chat; Hype listens and quietly turns what you
  say into a connected map you can actually see."
- Accent: topic blue.

### 3 — "Your memory, searchable."
- One idea: the second brain — revisit old nodes, follow how threads connect, watch the graph grow
  over weeks. Research your past; track your progress.
- Visual: a **timeline scrubber** / "then → now" — the same demo graph shown small (week 1) growing
  to large (week 8) as the user scrubs or on scroll.
- Body: "Every conversation adds to your graph. Come back and explore what you told it months ago,
  see new connections form, and watch yourself grow — one node at a time."
- Accent: topic green.

### 4 — "Total awareness. Total consent." (trust pillar — prominent)
- The honest deal, stated with pride, not fine print:
  - You can **see everything** Hype knows about you (it's your graph, in the open).
  - **Nothing leaves without your yes.** When something you actually want has a relevant offer,
    Hype asks first. You say yes or no. Never forced, never tracked around the web.
  - That consent is *why it's free* — stated plainly.
- Visual: a clean **consent panel mock** — a toggle row ("Show me relevant offers for: Style ✓ /
  Travel ✓ / Finance ✗") and a "Here's what I know about you" open-book panel.
- Body: "Hype is free because, with your explicit yes, it can surface offers you'd actually want.
  You see everything it knows, you choose what it can act on, and you can turn any of it off. That's
  the whole deal — no hidden tracking, no ads chasing you around the internet."
- Accent: topic amber.

### 5 — Closing CTA band
- Full-width, glowing. Headline (display): **"Start building your graph."**
- Subcopy: "Free to use. Yours to control."
- One primary CTA → `/signup`. Ambient graph glow behind.

### Footer (minimal)
- Wordmark · slogan ("Be in control of your ads. Only see what you want, when you want it.") ·
  links (Sign in, Privacy — Privacy can be a `#` placeholder for now).

## Components (new)

```
apps/web/
├── app/page.tsx                         ← rebuilt: logged-in → /graph; else render <Landing/>
├── app/(marketing)/…                    ← NOT needed; page.tsx composes sections directly
└── components/marketing/
    ├── Landing.tsx                      ← composes all sections (client where motion needed)
    ├── HeroGraph.tsx                    ← ambient demo graph (wraps GraphCanvas + demo data)
    ├── Nav.tsx                          ← sticky blurred nav
    ├── Section.tsx                      ← shared scroll-reveal wrapper (IntersectionObserver) + accent
    ├── TalkDemo.tsx                     ← §2 chat-bubble → node-birth split scene
    ├── GrowthTimeline.tsx               ← §3 then→now scrubber
    ├── ConsentPanel.tsx                 ← §4 consent toggle + "what I know" mock
    └── demoGraph.ts                     ← seeded demo nodes/links (no DB)
```

Fonts: add Space Grotesk + Inter in `app/layout.tsx` via `next/font/google` as CSS vars
(`--font-display`, `--font-body`); Tailwind `fontFamily` extended to expose them.

## Reuse (don't rebuild)
- `GraphCanvas.tsx` for the hero + timeline visuals (already has force sim, node-birth, topic colors).
- `TOPIC_COLORS` as the accent source of truth.
- Existing auth redirect pattern in `page.tsx`.

## Out of scope (YAGNI — not this spec)
- Real interactive demo you can chat with on the landing page (later; the hero is ambient/visual).
- Pricing page, blog, docs, about — single marketing page only.
- Working Privacy/Terms pages (link placeholders for now).
- Analytics/tracking scripts (add at deploy time if wanted).
- Mobile app store badges (app not built).

## Success criteria
- Logged-out `/` renders the cinematic page; logged-in `/` still redirects to `/graph`.
- Hero graph animates on load and reads as "live product," settles without pinning CPU.
- All four value stories present, with the hero = living graph and consent as a proud section.
- `pnpm build` clean; `prefers-reduced-motion` respected; responsive (mobile → single column,
  graph scales/simplifies).
- Visually cohesive with the dark app; accent colors sourced from the real topic palette.

## Open questions (resolve during planning, not blocking)
- Exact hero headline (3 candidates above — pick during build, easy to swap).
- §3 interaction: scroll-driven vs a draggable scrubber (start with scroll-driven; simpler).
- Whether the hero demo graph shows tooltips on hover (default: off for calm).

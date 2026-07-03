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

Hype is a **daily-use app you download** (iOS/Android planned; web works today). The page should
make it feel like an everyday companion, not a one-time novelty.

## Voice & copy principle (applies to every section)

**Lead with the life outcome; the feature is the mechanism.** Every headline is a benefit the
reader feels ("Never lose a recommendation again"), and the visual/body underneath shows the
feature that delivers it. Features alone don't convert — the reader has to see their own life
getting easier. Warm, plain-spoken, second-person ("you"), never fintech-cold.

## The value stories (and where each lives)

1. **The living graph** (the magic) → the **hero**. Most distinctive, screenshot-worthy thing.
   Outcome: *a place that remembers your whole world so you don't have to.*
2. **Just talk** → §2. Outcome: *offload the mental clutter — no forms, no filing.*
3. **Second brain** (research your past, track progress) → §3. Outcome: *never lose a
   recommendation, a plan, or a memory again.*
4. **Proactive assistant** (notifications) → §4. Outcome: *it reaches out to you — a quick chat to
   stay current, and a heads-up when something you actually want is worth knowing about.*
5. **Awareness & consent** (the honest data deal) → §5. Proud, prominent trust section — reframed
   from "control your ads" to "you see everything it knows; nothing happens without your yes."
   Outcome: *peace of mind — you're in control.*
6. **Take it everywhere** (download / daily companion) → §6. Outcome: *your assistant, in your
   pocket, every day.*

## Visual system

- **Base:** near-black `#0a0a0a` → transitions seamlessly into the app's `#0d0d0d` graph screen.
- **Accent axis:** reuse the app's real `TOPIC_COLORS` palette (GraphCanvas.tsx). Each feature
  section gets a topic-derived accent gradient, so the landing page is literally colored by the
  same system that colors the graph. This is the one distinctive, product-grounded aesthetic thread.
  - Hero / CTA band: white glow (`#ffffff` — the Profile "You" color)
  - §2 "Just talk": topic blue (`#60a5fa`, Work)
  - §3 "Second brain": topic green (`#4ade80`, Health)
  - §4 "Proactive assistant": topic cyan (`#22d3ee`, Location)
  - §5 "Awareness & consent": topic amber (`#fbbf24`, Home)
  - §6 "Take it everywhere": topic purple (`#a855f7`, Creativity)
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

### 2 — "Stop keeping it all in your head." (feature: just talk)
- Outcome headline: the reader offloads mental clutter. Feature underneath: no forms — you have a
  conversation and the graph builds itself.
- Visual: a **split scene** — an assistant chat bubble asking a question on one side; on the other,
  a node materializes + links in (scroll-triggered birth animation). Reuses the node-birth visual
  language from GraphCanvas.
- Body: "The people, plans, and things you're trying to remember don't belong in your head. Just
  talk to Hype like a friend — no setup, no forms, no tags — and it quietly turns what you say into
  a map you can actually see."
- Accent: topic blue.

### 3 — "Never lose a recommendation again." (feature: second brain / research + progress)
- Outcome headline: nothing you've been told or figured out ever slips away. Feature: revisit old
  nodes, follow how threads connect, watch the graph grow over weeks.
- Visual: a **timeline scrubber** / "then → now" — the same demo graph shown small (week 1) growing
  to large (week 8) as the user scrubs or on scroll.
- Body: "That restaurant a friend swore by, the gift idea you had in March, the book you meant to
  read — it's all still here, searchable. Come back anytime to explore what you told it, see new
  connections form, and watch yourself grow, one node at a time."
- Accent: topic green.

### 4 — "It remembers, so it can remind you." (feature: proactive notifications)
- Outcome headline: the assistant does the remembering *and* the reaching-out — the reader never has
  to remember to keep it updated or to go hunting for a deal. Two notification types:
  1. **A nudge to chat** — "Got two minutes? Tell me about your weekend." Keeps the graph current
     without the reader ever having to open the app on their own.
  2. **A heads-up when something you want is worth knowing about** — only for things you've said you
     want, and only categories you've consented to (forward-links to §5). Never spam.
- Visual: a **phone lock-screen mock** with two stacked Hype notifications (a chat nudge + a consent-
  gated offer alert), gently animating in.
- Body: "Life moves fast and you'll forget to check in — so Hype checks in with you. A quick,
  friendly nudge to catch up keeps your world current, and when something you actually told it you
  wanted is worth a look, it lets you know. You decide what's worth a ping; it never nags."
- Accent: topic cyan.

### 5 — "Total awareness. Total consent." (trust pillar — prominent)
- The honest deal, stated with pride, not fine print. Outcome: peace of mind — the reader is in
  control of their own data and what gets acted on.
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

### 6 — "Your assistant, in your pocket." (feature: download the app)
- Outcome headline: it's an everyday companion that goes where the reader goes. Feature: native
  iOS + Android apps for daily use.
- **Honesty constraint:** the mobile app is not built yet. Ship this section as **"Coming soon to
  iOS & Android."** The real, works-today CTA is the web app (`Start your graph` → `/signup`). Do
  NOT render live App Store / Google Play badges until the app exists (they'd 404 and break the
  trust the page is selling). Use "coming soon" badge treatments (disabled/labelled).
- Visual: a **phone in-hand / device mock** showing the graph home screen, with "Coming soon to iOS
  & Android" badges beneath.
- Body: "Hype is built to live in your pocket — a two-minute chat on the bus, a glance at your
  graph over coffee. The iOS and Android apps are on the way. Start on the web today and your graph
  comes with you when they land."
- Optional (decide at build, see open questions): a **notify-me email field** ("Be first to know
  when the app drops"). Default = omit (YAGNI: no capture backend yet).
- Accent: topic purple.

### 7 — Closing CTA band
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
    ├── NotifyPreview.tsx                ← §4 phone lock-screen with two Hype notifications
    ├── ConsentPanel.tsx                 ← §5 consent toggle + "what I know" mock
    ├── AppDownload.tsx                  ← §6 device mock + "coming soon" iOS/Android badges
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
- **Live** App Store / Google Play badges — app not built; §6 ships "coming soon" only.
- Real push-notification delivery — §4 shows the *promise* via a mock; the feature is app-side, later.
- Notify-me email capture backend (no store yet; email field is optional and omitted by default).

## Success criteria
- Logged-out `/` renders the cinematic page; logged-in `/` still redirects to `/graph`.
- Hero graph animates on load and reads as "live product," settles without pinning CPU.
- All six value stories present, hero = living graph, consent a proud section, every section
  headline leads with a life outcome (not a bare feature name).
- §6 sets the "download & use daily" expectation honestly (coming-soon, web CTA works today).
- §4 communicates proactive notifications (chat nudge + consent-gated offer alert).
- `pnpm build` clean; `prefers-reduced-motion` respected; responsive (mobile → single column,
  graph scales/simplifies).
- Visually cohesive with the dark app; accent colors sourced from the real topic palette.

## Open questions (resolve during planning, not blocking)
- Exact hero headline (3 candidates above — pick during build, easy to swap).
- §3 interaction: scroll-driven vs a draggable scrubber (start with scroll-driven; simpler).
- Whether the hero demo graph shows tooltips on hover (default: off for calm).
- §6 notify-me email field: include or omit (default omit until there's a capture backend).

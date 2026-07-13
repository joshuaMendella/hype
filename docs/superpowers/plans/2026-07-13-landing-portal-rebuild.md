# Portal-Style Landing Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Visual tasks (5–10) should load the `frontend-design` skill before writing JSX.

**Goal:** Replace the current landing page with a Portal-style (useportal.net), 11-block long-form page that recruits beta testers via an email waitlist.

**Architecture:** Fresh section components built alongside the old page (build stays green throughout); the old page is only swapped out in the final task when `Landing.tsx` is rewritten and old components are deleted. A dusk→day→night visual arc: dark constellation hero, warm paper storytelling sections, night footer. New `waitlist` table + one public API route.

**Tech Stack:** Next.js 16 App Router, Tailwind v4 (`@theme inline` tokens), D3 (installed), Supabase (admin client for waitlist), `next/font/google`. **No new npm dependencies.**

**Spec:** `docs/superpowers/specs/2026-07-13-landing-portal-style-design.md` — the 11-block section map there is binding.

## Global Constraints

- **Lexicon (absolute, from BUSINESS.md):** user-facing copy says "find," "offer," or "suggestion" — **never "ad" or "ads" or "advertising."** Copy in this plan is pre-cleared: use it **verbatim**; do not paraphrase.
- **No "free because…" framing** anywhere. Free is stated as a fact, never as a trade explained by finds.
- No copy may imply toggles or an ad-settings page — consent is per-moment, in chat.
- `pnpm build` (run from `apps/web`) must pass at every commit. The old landing keeps rendering until Task 11.
- No new npm packages. Fonts come from `next/font/google` (already the pattern in `app/layout.tsx`).
- Accent colors come from the graph's real palette (`lib/graph/palettes.ts` BASE_COLORS values) — exact hexes are inlined in the copy specs below.
- All paths below are relative to `apps/web/` unless they start with `docs/` or say otherwise.
- Commit after every task with the message given in the task.
- `components/marketing/Reveal.tsx` and `components/marketing/graphData.ts` are kept and reused as-is.

---

### Task 1: Waitlist table + API route

**Files:**
- Modify: `supabase/schema.sql` (append after the `events` table block, ~line 243)
- Create: `app/api/waitlist/route.ts`

**Interfaces:**
- Produces: `POST /api/waitlist` accepting `{ email: string }` → `200 {ok:true}` | `400 {error:"invalid_email"}` | `500 {error:"server_error"}`. Task 3's `WaitlistForm` posts to it.

- [ ] **Step 1: Append the table to `supabase/schema.sql`**

```sql
-- Beta waitlist — public signups from the landing page.
-- RLS ENABLED, NO policies: service-role admin client only (same pattern as scout_cache).
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Apply the migration to the live project**

Use the Supabase MCP tool `mcp__supabase__apply_migration` with name `create_waitlist` and the exact SQL above. Then verify with `mcp__supabase__list_tables` — expect `waitlist` present with `rls_enabled: true`.

- [ ] **Step 3: Create `app/api/waitlist/route.ts`**

```ts
// apps/web/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Public endpoint (no auth — visitors aren't logged in). Admin client because the
// waitlist table has RLS with no policies (same pattern as scout_cache).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }
  const admin = createAdminClient()
  // ponytail: duplicate signups return ok:true on purpose — "already on the list" is success.
  const { error } = await admin
    .from("waitlist")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Verify with curl against the dev server**

Start the dev server if not running (`cd apps/web && pnpm dev`), then:

```bash
curl -s -X POST http://localhost:3000/api/waitlist -H "Content-Type: application/json" -d '{"email":"not-an-email"}'
# Expected: {"error":"invalid_email"}
curl -s -X POST http://localhost:3000/api/waitlist -H "Content-Type: application/json" -d '{"email":"plan-check@example.com"}'
# Expected: {"ok":true}
curl -s -X POST http://localhost:3000/api/waitlist -H "Content-Type: application/json" -d '{"email":"plan-check@example.com"}'
# Expected: {"ok":true}   (duplicate — still success)
```

Then delete the test row via `mcp__supabase__execute_sql`: `DELETE FROM public.waitlist WHERE email = 'plan-check@example.com';`

- [ ] **Step 5: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/supabase/schema.sql apps/web/app/api/waitlist/route.ts
git commit -m "feat(landing): waitlist table + public POST /api/waitlist"
```

---

### Task 2: Design tokens + handwriting font

**Files:**
- Modify: `app/globals.css` (the `@theme inline` block, lines 8–30)
- Modify: `app/layout.tsx` (font imports, lines 1–37 and the `<body>` className)

**Interfaces:**
- Produces: Tailwind utilities `bg-paper`, `text-ink`, `text-ink-soft`, `bg-card`, `text-star`, plus CSS classes `.dusk-sky`, `.night-sky`, and the `font-hand` utility. All section tasks (5–10) consume these.

- [ ] **Step 1: Add the new tokens inside the existing `@theme inline` block in `globals.css`**

Append these lines just before the closing `}` of `@theme inline` (keep every existing token — old components still use them until Task 11):

```css
  /* ── Portal-style rebuild tokens (2026-07-13) ─────────────────────
     Dusk→day→night arc. paper/ink = the warm daylight sections;
     dusk-*/horizon = the hero sky; star = text on night surfaces. */
  --color-dusk-0: #08061c;
  --color-dusk-1: #241a4d;
  --color-dusk-2: #6b3d8f;
  --color-horizon: #f2a65e;
  --color-paper: #faf7f2;
  --color-ink: #211a12;
  --color-ink-soft: #6f6558;
  --color-card: #ffffff;
  --color-star: #f4f1ff;
  --font-hand: var(--font-caveat);
```

- [ ] **Step 2: Add the sky gradient classes to `globals.css`**

Append after the `.hype-float` rule:

```css
/* ── Portal-style rebuild skies ──────────────────────────────────── */
.dusk-sky {
  background: linear-gradient(180deg, #08061c 0%, #241a4d 42%, #6b3d8f 72%, #b85c72 88%, #f2a65e 100%);
}
.night-sky {
  background: linear-gradient(180deg, #0b0920 0%, #1a1240 70%, #241a4d 100%);
}
```

- [ ] **Step 3: Add the Caveat font in `app/layout.tsx`**

Add `Caveat` to the existing `next/font/google` import, instantiate it alongside the other faces, and add its variable to the `<body>` className string:

```ts
import { Geist, Poppins, Space_Grotesk, Inter, Bricolage_Grotesque, Hanken_Grotesk, Space_Mono, Caveat } from "next/font/google"

// Handwritten annotations on the landing page (Portal-style margin notes + signature).
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-caveat",
})
```

And in the body className, append `${caveat.variable}` next to the other font variables.

- [ ] **Step 4: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "feat(landing): dusk/paper/night token layer + Caveat hand font"
```

---

### Task 3: WaitlistForm component

**Files:**
- Create: `components/marketing/WaitlistForm.tsx`

**Interfaces:**
- Consumes: `POST /api/waitlist` (Task 1).
- Produces: `<WaitlistForm />` (client component, no props). Used by `Hero.tsx` (Task 5) and `Footer.tsx` (Task 10). Both placements sit on dark sky, so it is styled for dark only.

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { useState } from "react"

// Email capture for the beta waitlist. Both placements (hero dusk, footer night)
// sit on dark sky, so this is styled for dark surfaces only.
export default function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === "busy") return
    setState("busy")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <p className="font-body rounded-full border border-white/20 bg-white/10 px-6 py-3 text-center text-sm text-star backdrop-blur">
        You&apos;re on the list — talk soon. ✓
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle") }}
        placeholder="you@example.com"
        aria-label="Email address"
        className="font-body min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm text-star placeholder:text-star/40 backdrop-blur outline-none transition focus:border-white/60"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="font-body shrink-0 rounded-full bg-star px-6 py-3 text-sm font-semibold text-dusk-0 shadow-[0_0_32px_-8px_rgba(244,241,255,0.7)] transition hover:scale-[1.03] disabled:opacity-60"
      >
        {state === "busy" ? "Joining…" : "Join the waitlist"}
      </button>
      {state === "error" && (
        <p className="font-body text-xs text-[#fca5a5] sm:absolute sm:mt-14" role="alert">
          That didn&apos;t work — check the email and try again.
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/WaitlistForm.tsx
git commit -m "feat(landing): WaitlistForm email-capture component"
```

(Behavior is exercised visually in Task 5's verify step, against the real route from Task 1.)

---

### Task 4: Constellation graph (hero star field)

**Files:**
- Create: `components/marketing/Constellation.tsx` (fork of `DemoGraph.tsx` — do NOT modify `DemoGraph.tsx`; the old page still uses it until Task 11)

**Interfaces:**
- Consumes: `DEMO_NODES`, `DEMO_LINKS` from `./graphData` (unchanged).
- Produces: `<Constellation className? fill? />` — same `fill`/`className` semantics as DemoGraph, no `progress` prop (always reveals fully, staggered on load). Used by `Hero.tsx` (Task 5) and `Footer.tsx` (Task 10).

- [ ] **Step 1: Create the component**

Copy `DemoGraph.tsx` into `Constellation.tsx`, then apply exactly these changes (final file below — use it verbatim):

```tsx
"use client"

import { useEffect, useRef } from "react"
import * as d3 from "d3"
import { DEMO_NODES, DEMO_LINKS, type DemoNode, type DemoLink } from "./graphData"

// The hero star field: the demo graph re-skinned as a constellation. Forked from
// DemoGraph (which the old landing still uses) rather than parameterized — the two
// skins share no runtime and DemoGraph dies with the old page.
// Nodes render as glowing stars (topic color washed toward starlight), links as
// faint constellation lines, labels on hubs only.

type SimNode = DemoNode & d3.SimulationNodeDatum
type SimLink = { source: SimNode; target: SimNode; kind: DemoLink["kind"] }

const W = 800
const H = 600
const radius = (n: DemoNode) => (n.id === "you" ? 10 : n.hub ? 6.5 : 4)
const starColor = (c: string) => d3.interpolateRgb(c, "#ffffff")(0.5)

export default function Constellation({
  className,
  fill = false,
}: {
  className?: string
  /** Cover the container (hero backdrop) instead of letterboxing inside it. */
  fill?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const svg = d3.select(svgRef.current!)
    svg.selectAll("*").remove()

    const nodes: SimNode[] = DEMO_NODES.map((n) => ({ ...n }))
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const links: SimLink[] = DEMO_LINKS.map((l) => ({
      source: byId.get(l.s)!,
      target: byId.get(l.t)!,
      kind: l.kind,
    }))

    const g = svg.append("g").attr("class", reduce ? "" : "hype-float")

    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1)
      .attr("opacity", 0)

    const node = g.append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")

    const glow = node.append("circle")
      .attr("r", (d) => radius(d) + 8)
      .attr("fill", (d) => starColor(d.color))
      .attr("opacity", 0)

    const core = node.append("circle")
      .attr("r", 0)
      .attr("fill", (d) => starColor(d.color))
      .attr("opacity", 0.95)

    node.filter((d) => !!d.hub).append("text")
      .text((d) => d.label)
      .attr("dy", (d) => radius(d) + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("fill", "#ffffff")
      .attr("pointer-events", "none")
      .style("font-family", "var(--font-body), sans-serif")
      .attr("opacity", 0)

    const sim = d3.forceSimulation<SimNode>(nodes)
      .force("link", d3.forceLink<SimNode, SimLink>(links).distance(90).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-340))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide<SimNode>().radius((d) => radius(d) + 16))

    sim.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x ?? 0).attr("y1", (d) => d.source.y ?? 0)
        .attr("x2", (d) => d.target.x ?? 0).attr("y2", (d) => d.target.y ?? 0)
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Stagger the stars in on load so the sky reads as being drawn.
    const shown = new Set<string>()
    const reveal = (n: SimNode, animate: boolean) => {
      shown.add(n.id)
      const g2 = node.filter((d) => d.id === n.id)
      const c = g2.select<SVGCircleElement>("circle:nth-child(2)")
      const gl = g2.select<SVGCircleElement>("circle:nth-child(1)")
      const tx = g2.select<SVGTextElement>("text")
      if (animate && !reduce) {
        c.transition().duration(700).ease(d3.easeElasticOut.amplitude(1).period(0.5)).attr("r", radius(n))
        gl.attr("opacity", 0.4).transition().duration(900).ease(d3.easeCubicOut).attr("opacity", 0.16)
        tx.transition().delay(200).duration(400).attr("opacity", 0.55)
      } else {
        c.attr("r", radius(n))
        gl.attr("opacity", 0.16)
        tx.attr("opacity", 0.55)
      }
      link.transition().duration(animate ? 500 : 0)
        .attr("opacity", (d) => (shown.has(d.source.id) && shown.has(d.target.id) ? 0.18 : 0))
    }

    if (reduce) {
      nodes.forEach((n) => reveal(n, false))
    } else {
      const ordered = [...nodes].sort((a, b) => a.revealAt - b.revealAt)
      ordered.forEach((n, i) => setTimeout(() => reveal(n, true), 150 + i * 110))
    }

    return () => { sim.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={fill ? "xMidYMid slice" : "xMidYMid meet"}
      className={className}
      aria-hidden="true"
    />
  )
}
```

(Note: `glow` and `core` are assigned for symmetry with the fork source; if ESLint flags `core`/`glow` as unused, inline them — the selects in `reveal` address them positionally.)

- [ ] **Step 2: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/Constellation.tsx
git commit -m "feat(landing): Constellation star-field graph (DemoGraph fork)"
```

---

### Task 5: SiteNav + Hero (blocks 1–2)

**Files:**
- Create: `components/marketing/SiteNav.tsx`
- Create: `components/marketing/Hero.tsx`

**Interfaces:**
- Consumes: `WaitlistForm` (Task 3), `Constellation` (Task 4), `.dusk-sky` class + tokens (Task 2).
- Produces: `<SiteNav />` and `<Hero />` (no props). Anchor targets used: `#how-it-works` (Task 7 section), `#the-deal` (Task 9 section), `#join` (Task 10 footer). `Hero` must end with the app-card overlapping into the next (paper) section via negative bottom margin — `Landing.tsx` (Task 11) compensates with padding.

- [ ] **Step 1: Create `SiteNav.tsx`**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

// Sticky top nav — transparent over the dusk hero, gains a dark blurred bar on scroll.
export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-white/10 bg-dusk-0/70 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-star">
          Hype
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <a href="#how-it-works" className="font-body hidden px-3 py-2 text-sm text-star/70 transition-colors hover:text-star sm:block">
            How it works
          </a>
          <a href="#the-deal" className="font-body hidden px-3 py-2 text-sm text-star/70 transition-colors hover:text-star sm:block">
            The deal
          </a>
          <Link href="/login" className="font-body px-3 py-2 text-sm text-star/70 transition-colors hover:text-star">
            Sign in
          </Link>
          <a
            href="#join"
            className="font-body rounded-full bg-star px-4 py-2 text-sm font-semibold text-dusk-0 transition-transform hover:scale-[1.03]"
          >
            Join the waitlist
          </a>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: Create `Hero.tsx`**

The app-card is a live composed mock (Constellation on a dark app-like canvas + a chat input bar), styled like a screenshot in a device-style frame. It is the designated swap slot: when the owner supplies a real capture, its inner content is replaced by an `<img src="/app-shot.png">`.

```tsx
import Constellation from "./Constellation"
import WaitlistForm from "./WaitlistForm"

// Block 2 — dusk sky, constellation star field, headline, waitlist form, and the
// app-shot card sitting on the horizon line (Portal's screenshot-over-landscape move).
// The card's negative bottom margin makes it overlap the paper section below;
// Landing.tsx gives the next section matching top padding.
export default function Hero() {
  return (
    <section className="dusk-sky relative overflow-visible pb-0 pt-28 sm:pt-36">
      {/* Star field behind the copy */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <Constellation fill className="h-full w-full" />
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="hero-in font-mono rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-star/80 backdrop-blur" style={{ "--hero-delay": "0ms" } as React.CSSProperties}>
          Closed beta — limited seats
        </span>
        <h1
          className="hero-in font-display mt-6 text-balance text-[clamp(2.6rem,7vw,4.75rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-star"
          style={{ "--hero-delay": "120ms" } as React.CSSProperties}
        >
          Meet the AI that remembers you.
          <br />
          Watch your world become a map.
        </h1>
        <p
          className="hero-in font-body mt-6 max-w-xl text-pretty text-lg leading-relaxed text-star/75"
          style={{ "--hero-delay": "240ms" } as React.CSSProperties}
        >
          Hype learns who you are through real conversation — and turns it into a
          living, glowing graph of everything that makes you <em>you</em>. Yours to
          see, edit, and take anywhere.
        </p>
        <div className="hero-in mt-8 flex w-full justify-center" style={{ "--hero-delay": "360ms" } as React.CSSProperties}>
          <WaitlistForm />
        </div>
        <p className="hero-in font-body mt-3 text-xs text-star/50" style={{ "--hero-delay": "420ms" } as React.CSSProperties}>
          Free in beta · No card, ever
        </p>
      </div>

      {/* App-shot card on the horizon — swap inner content for /app-shot.png when captured. */}
      <div className="relative z-10 mx-auto -mb-24 mt-16 w-[min(92%,56rem)] sm:-mb-32">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0d0d0d] shadow-[0_40px_120px_-24px_rgba(8,6,28,0.8)]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="font-mono ml-3 text-[10px] uppercase tracking-widest text-white/30">Hype — your graph</span>
          </div>
          <div className="relative aspect-[16/9]">
            <Constellation fill className="h-full w-full" />
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
              <span className="font-body flex-1 text-left text-sm text-white/40">Tell me about your week…</span>
              <span className="font-body rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-black">Send</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Temporary visual check**

Temporarily render the new blocks by replacing the body of `app/page.tsx`'s return with:

```tsx
return (
  <div className="landing bg-paper">
    <SiteNav />
    <Hero />
    <div className="h-[60vh]" />
  </div>
)
```

(with the two imports added). Run `pnpm dev`, open `http://localhost:3000` in the browser, and verify: dusk gradient renders, stars stagger in, headline/subhead/form legible over the star field, form submit shows "You're on the list" (then delete the test row via `mcp__supabase__execute_sql`), app-card overlaps the paper area below. **Then revert `app/page.tsx` to its committed state** (`git checkout apps/web/app/page.tsx`) — the switchover happens in Task 11.

- [ ] **Step 4: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/SiteNav.tsx apps/web/components/marketing/Hero.tsx
git commit -m "feat(landing): SiteNav + dusk constellation Hero with app-shot card"
```

---

### Task 6: Statement primitive + IconGrid (blocks 3–4)

**Files:**
- Create: `components/marketing/Statement.tsx`
- Create: `components/marketing/IconGrid.tsx`

**Interfaces:**
- Consumes: `Reveal` (existing), paper/ink tokens (Task 2).
- Produces: `<Statement kicker color title id? children? />` — the shared big-statement header used by Tasks 6, 7, 8, 9. `<IconGrid />` (no props). Block 3's statement is rendered by `Landing.tsx` (Task 11) via `Statement` directly; `IconGrid` is block 4.

- [ ] **Step 1: Create `Statement.tsx`**

```tsx
import Reveal from "./Reveal"
import type { ReactNode } from "react"

// Portal-style big statement: mono kicker, display headline, optional body copy.
// Used standalone (block 3) and as the header of blocks 5–9.
export default function Statement({
  kicker,
  color,
  title,
  id,
  children,
}: {
  kicker: string
  color: string
  title: ReactNode
  /** Anchor target (offset above the block so the sticky nav doesn't cover it). */
  id?: string
  children?: ReactNode
}) {
  return (
    <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
      {id && <span id={id} className="absolute -top-24" aria-hidden="true" />}
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]" style={{ color }}>
        {kicker}
      </p>
      <h2 className="font-display mt-4 text-balance text-[clamp(2rem,5vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {children && (
        <div className="font-body mx-auto mt-6 max-w-2xl space-y-4 text-pretty text-lg leading-relaxed text-ink-soft">
          {children}
        </div>
      )}
    </Reveal>
  )
}
```

- [ ] **Step 2: Create `IconGrid.tsx`**

Copy is verbatim. Colors are real BASE_COLORS hexes from `lib/graph/palettes.ts`.

```tsx
import Reveal from "./Reveal"

// Block 4 — Portal's 8-item colored icon grid, with topic colors from the real graph
// palette and a handwritten margin note.
const ITEMS: { icon: string; color: string; title: string; body: string }[] = [
  { icon: "💬", color: "#a78bfa", title: "Talk, don't fill forms", body: "No setup, no surveys. Hype interviews you like a curious friend." },
  { icon: "✨", color: "#a855f7", title: "Watch your graph grow", body: "Every fact becomes a glowing node the moment you share it." },
  { icon: "🧠", color: "#6366f1", title: "Perfect recall", body: "“What was that coffee place in Lisbon?” It knows." },
  { icon: "📅", color: "#f0abfc", title: "It looks ahead", body: "Birthdays, trips, tickets — surfaced before they sneak up on you." },
  { icon: "🪞", color: "#fde68a", title: "It reflects with you", body: "“A year ago you were obsessed with film photography. Still?”" },
  { icon: "🎁", color: "#f472b6", title: "Finds you'd actually want", body: "Hyper-tailored suggestions — only when you say yes." },
  { icon: "🔍", color: "#4ade80", title: "Own every fact", body: "See everything it knows. Correct or delete anything, anytime." },
  { icon: "🎒", color: "#67e8f9", title: "Take it anywhere", body: "Plain markdown, Obsidian-compatible. Export with one tap." },
]

export default function IconGrid() {
  return (
    <div className="relative mx-auto max-w-4xl px-6">
      <p className="font-hand pointer-events-none absolute -top-10 right-8 rotate-[-4deg] text-2xl text-ink-soft/80" aria-hidden="true">
        your life, one node at a time ↓
      </p>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {ITEMS.map((it, i) => (
          <Reveal key={it.title} delay={(i % 2) * 80} className="flex items-start gap-4">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${it.color}33`, boxShadow: `0 0 0 1px ${it.color}55 inset` }}
              aria-hidden="true"
            >
              {it.icon}
            </span>
            <span>
              <span className="font-display block text-base font-bold text-ink">{it.title}</span>
              <span className="font-body mt-1 block text-[0.95rem] leading-relaxed text-ink-soft">{it.body}</span>
            </span>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/Statement.tsx apps/web/components/marketing/IconGrid.tsx
git commit -m "feat(landing): Statement primitive + 8-item IconGrid (blocks 3-4)"
```

Block 3's copy (rendered via `Statement` in Task 11 — recorded here so the copy lives in one reviewed place):
- kicker: `Why Hype exists`, color `#a78bfa`
- title: `You've told a hundred apps who you are. Not one of them was listening.`
- body p1: `Your music app knows your playlists. Your maps app knows your commute. Your shopping app knows your size. Each one holds a sliver of you, none of them talk to each other — and not one could tell you your best friend's birthday.`
- body p2: `Hype starts from the opposite end: one genuine conversation at a time, it learns your world the way a friend would — and keeps it in a graph you can actually see. Not for our benefit. For yours.`

---

### Task 7: DeepDives — 4 alternating rows (block 5)

**Files:**
- Create: `components/marketing/DeepDives.tsx`

**Interfaces:**
- Consumes: `Reveal`, paper/ink/card tokens.
- Produces: `<DeepDives />` (no props) — includes its own `Statement`-style header internally? **No** — `Landing.tsx` renders the block-5 `Statement` (header) then `<DeepDives />` (the 4 rows). Header copy is at the end of this task.

- [ ] **Step 1: Create `DeepDives.tsx`**

Each row: visual card on one side, copy on the other, alternating (`sm:flex-row` / `sm:flex-row-reverse`). Visuals are static styled DOM (Portal uses static images; ours are richer). Copy verbatim.

```tsx
import Reveal from "./Reveal"
import type { ReactNode } from "react"

// Block 5 — four alternating deep-dive rows: interview, vault, give-back, finds.
// Visual cards are static DOM mocks (no animation beyond the Reveal rise).

function Row({
  flip = false,
  kicker,
  color,
  title,
  body,
  visual,
}: {
  flip?: boolean
  kicker: string
  color: string
  title: string
  body: ReactNode
  visual: ReactNode
}) {
  return (
    <Reveal className={`flex flex-col items-center gap-10 sm:gap-16 ${flip ? "sm:flex-row-reverse" : "sm:flex-row"}`}>
      <div className="w-full sm:w-1/2">{visual}</div>
      <div className="w-full sm:w-1/2">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]" style={{ color }}>{kicker}</p>
        <h3 className="font-display mt-3 text-balance text-2xl font-extrabold leading-tight tracking-[-0.01em] text-ink sm:text-3xl">{title}</h3>
        <div className="font-body mt-4 space-y-3 text-pretty leading-relaxed text-ink-soft">{body}</div>
      </div>
    </Reveal>
  )
}

const cardBase = "rounded-2xl border border-ink/10 bg-card p-5 shadow-[0_16px_48px_-20px_rgba(33,26,18,0.25)]"

function InterviewVisual() {
  return (
    <div className={cardBase}>
      <div className="space-y-3">
        <p className="font-body max-w-[85%] rounded-2xl rounded-tl-sm bg-ink/5 px-4 py-2.5 text-sm text-ink">
          You mentioned a marathon — which one are you training for?
        </p>
        <p className="font-body ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#241a4d] px-4 py-2.5 text-sm text-star">
          Berlin, in September! My first one.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: "Berlin Marathon", color: "#34d399" },
          { label: "Running", color: "#34d399" },
        ].map((n) => (
          <span key={n.label} className="font-body inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-ink" style={{ backgroundColor: `${n.color}26`, boxShadow: `0 0 0 1px ${n.color}66 inset` }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: n.color }} />
            {n.label}
            <span className="text-ink-soft/70">+ new node</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function VaultVisual() {
  return (
    <div className={`${cardBase} font-mono text-[13px] leading-relaxed text-ink`}>
      <p className="text-ink-soft"># Berlin Marathon</p>
      <p className="mt-2 text-ink-soft/70">topic: Sports · type: event</p>
      <p className="mt-3">First marathon. September 2026.</p>
      <p>
        Training with <span className="rounded bg-[#34d39926] px-1 text-[#0f766e]">[[Running]]</span> plan,
        goal is simply to finish.
      </p>
      <p className="mt-3 text-ink-soft/70">— a plain .md file, yours to keep</p>
    </div>
  )
}

function GiveBackVisual() {
  const CARDS = [
    { icon: "🎂", text: "Your sister's birthday is next Tuesday. Flowers again, or braver this year?" },
    { icon: "☕", text: "That Lisbon coffee place you loved: Copenhagen Coffee Lab, near Príncipe Real." },
    { icon: "📷", text: "A year ago today you bought your first film camera. Still shooting?" },
  ]
  return (
    <div className="space-y-3">
      {CARDS.map((c, i) => (
        <div key={c.icon} className={`${cardBase} flex items-start gap-3 !p-4`} style={{ transform: `translateX(${i * 12 - 12}px)` }}>
          <span aria-hidden="true">{c.icon}</span>
          <p className="font-body text-sm leading-relaxed text-ink">{c.text}</p>
        </div>
      ))}
    </div>
  )
}

function FindsVisual() {
  return (
    <div className="space-y-3">
      <div className={`${cardBase} !p-4`}>
        <p className="font-body text-sm leading-relaxed text-ink">
          Your Pegasus pair is nearly done for — want me to pull up a couple of current deals?
        </p>
        <div className="mt-3 flex gap-2">
          <span className="font-body rounded-full bg-[#241a4d] px-4 py-1.5 text-xs font-semibold text-star">Yes, show me</span>
          <span className="font-body rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink-soft">Not now</span>
        </div>
      </div>
      <div className={`${cardBase} !p-4`}>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft/70">Sponsored · you said yes</p>
        <p className="font-body mt-2 text-sm font-semibold text-ink">Nike Pegasus 41 — 30% off this week</p>
        <p className="font-body mt-1 text-xs text-ink-soft">Matched to: “running shoes falling apart”</p>
      </div>
    </div>
  )
}

export default function DeepDives() {
  return (
    <div className="mx-auto max-w-5xl space-y-24 px-6 sm:space-y-32">
      <Row
        kicker="The interview"
        color="#a78bfa"
        title="Just talk. It does the remembering."
        body={<p>Hype asks the kind of questions a good friend would — what you're into, where you've been, what's coming up. Every answer becomes part of your graph, live, while you watch.</p>}
        visual={<InterviewVisual />}
      />
      <Row
        flip
        kicker="The vault"
        color="#2dd4bf"
        title="Your memory, in plain text you own."
        body={<p>Behind every node is a simple markdown note — readable by you, editable by you, exportable to Obsidian or anywhere else. No proprietary format, no lock-in. If you ever leave, everything goes with you.</p>}
        visual={<VaultVisual />}
      />
      <Row
        kicker="It gives back"
        color="#67e8f9"
        title="The longer it knows you, the more it gives back."
        body={<p>Ask it anything from your own life and it answers from your vault. It remembers the dates you'd feel bad forgetting. And sometimes it holds up a mirror: who were you a year ago?</p>}
        visual={<GiveBackVisual />}
      />
      <Row
        flip
        kicker="Finds"
        color="#f472b6"
        title="Finds you'd actually want. Only when you say yes."
        body={
          <>
            <p>When you mention your running shoes are falling apart, Hype asks if you'd like to see a couple of current deals. Say yes and you get one clearly-labeled find, matched to what you actually said.</p>
            <p>Say no and the conversation simply moves on — it never pushes, never sneaks. Only what you want, when you want it.</p>
          </>
        }
        visual={<FindsVisual />}
      />
    </div>
  )
}
```

- [ ] **Step 2: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/DeepDives.tsx
git commit -m "feat(landing): four deep-dive rows — interview, vault, give-back, finds (block 5)"
```

Block 5's header copy (rendered via `Statement` in Task 11, with `id="how-it-works"`):
- kicker: `What you get`, color `#2dd4bf`
- title: `A memory you can watch being made.`
- body: `Four things happen when you talk to Hype. Here's each one, up close.`

---

### Task 8: OwnershipGrid + MiniGraph + PaletteShowcase (blocks 6–7)

**Files:**
- Create: `components/marketing/OwnershipGrid.tsx`
- Create: `components/marketing/MiniGraph.tsx`
- Create: `components/marketing/PaletteShowcase.tsx`

**Interfaces:**
- Consumes: `Reveal`; `nodeColorFor`, `PALETTE_MODES`, `type PaletteMode` from `@/lib/graph/palettes`.
- Produces: `<OwnershipGrid />`, `<PaletteShowcase />` (no props); `<MiniGraph mode={PaletteMode} />` (static SVG, internal to PaletteShowcase but exported).

- [ ] **Step 1: Create `OwnershipGrid.tsx`**

```tsx
import Reveal from "./Reveal"

// Block 6 — Portal's 2×2 pain-point grid + wide bottom card, flipped to data ownership.
const CELLS: { icon: string; color: string; title: string; body: string }[] = [
  { icon: "👁️", color: "#60a5fa", title: "Every fact, visible", body: "The graph is the whole profile. If it's not a node you can see, Hype doesn't know it." },
  { icon: "✏️", color: "#4ade80", title: "Correct or delete anything", body: "Wrong city? Old phase? Edit the note or delete the node. Gone means gone." },
  { icon: "📦", color: "#67e8f9", title: "Export everything", body: "One tap gives you the entire vault as plain markdown files." },
  { icon: "🤝", color: "#fbbf24", title: "It asks first", body: "No find ever appears without your yes — one per conversation, clearly labeled." },
]

export default function OwnershipGrid() {
  return (
    <div className="mx-auto max-w-4xl px-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {CELLS.map((c, i) => (
          <Reveal key={c.title} delay={(i % 2) * 80} className="rounded-2xl border border-ink/10 bg-card p-6 shadow-[0_12px_40px_-20px_rgba(33,26,18,0.2)]">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
              style={{ backgroundColor: `${c.color}33`, boxShadow: `0 0 0 1px ${c.color}55 inset` }}
              aria-hidden="true"
            >
              {c.icon}
            </span>
            <h3 className="font-display mt-4 text-lg font-bold text-ink">{c.title}</h3>
            <p className="font-body mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{c.body}</p>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120} className="mt-6 rounded-2xl bg-[#241a4d] p-8 text-center shadow-[0_16px_48px_-20px_rgba(36,26,77,0.5)]">
        <h3 className="font-display text-xl font-bold text-star">The graph is the privacy policy.</h3>
        <p className="font-body mx-auto mt-2 max-w-xl leading-relaxed text-star/70">
          Most privacy policies describe what a company takes. Your graph shows what
          Hype knows — all of it, on your home screen, every day.
        </p>
      </Reveal>
    </div>
  )
}
```

- [ ] **Step 2: Create `MiniGraph.tsx`**

Static SVG with hardcoded positions (no simulation — deterministic, renders on the server), colored live through the real palette transform so all four modes are genuine.

```tsx
import { nodeColorFor, type PaletteMode } from "@/lib/graph/palettes"

// Static mini graph for the palette showcase — hardcoded layout, colors computed
// through the app's real palette transform so every mode shown is the genuine article.
// ponytail: positions hand-placed, no d3 — 11 nodes don't need a simulation.
const NODES: { id: string; topic: string; x: number; y: number; r: number }[] = [
  { id: "you", topic: "Profile", x: 100, y: 75, r: 9 },
  { id: "a", topic: "Sports", x: 48, y: 38, r: 6 },
  { id: "b", topic: "Relationships", x: 152, y: 34, r: 6 },
  { id: "c", topic: "Work", x: 170, y: 92, r: 6 },
  { id: "d", topic: "Travel", x: 132, y: 126, r: 6 },
  { id: "e", topic: "Food", x: 58, y: 118, r: 6 },
  { id: "f", topic: "Hobbies", x: 26, y: 82, r: 5 },
  { id: "g", topic: "Style", x: 22, y: 20, r: 4 },
  { id: "h", topic: "Entertainment", x: 182, y: 18, r: 4 },
  { id: "i", topic: "Location", x: 176, y: 132, r: 4 },
  { id: "j", topic: "Health", x: 74, y: 22, r: 4 },
]
const LINKS: [string, string][] = [
  ["you", "a"], ["you", "b"], ["you", "c"], ["you", "d"], ["you", "e"], ["you", "f"],
  ["a", "g"], ["a", "j"], ["b", "h"], ["d", "i"], ["e", "d"],
]
const at = (id: string) => NODES.find((n) => n.id === id)!

export default function MiniGraph({ mode }: { mode: PaletteMode }) {
  return (
    <svg viewBox="0 0 200 150" className="h-auto w-full" aria-hidden="true">
      <rect width="200" height="150" rx="12" fill="#0d0d0d" />
      {LINKS.map(([s, t]) => (
        <line key={`${s}-${t}`} x1={at(s).x} y1={at(s).y} x2={at(t).x} y2={at(t).y} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      ))}
      {NODES.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={nodeColorFor(n.topic, mode)} opacity="0.18" />
          <circle cx={n.x} cy={n.y} r={n.r} fill={nodeColorFor(n.topic, mode)} opacity="0.95" />
        </g>
      ))}
    </svg>
  )
}
```

- [ ] **Step 3: Create `PaletteShowcase.tsx`**

```tsx
import Reveal from "./Reveal"
import MiniGraph from "./MiniGraph"
import { PALETTE_MODES } from "@/lib/graph/palettes"

// Block 7 — Portal's screenshot strip, as the four real palette modes side by side.
export default function PaletteShowcase() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
        {PALETTE_MODES.map((mode, i) => (
          <Reveal key={mode} delay={i * 80} className="overflow-hidden rounded-2xl border border-ink/10 bg-card p-3 shadow-[0_12px_40px_-20px_rgba(33,26,18,0.2)]">
            <MiniGraph mode={mode} />
            <p className="font-mono mt-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">{mode}</p>
          </Reveal>
        ))}
      </div>
      <Reveal delay={160}>
        <p className="font-hand mt-6 rotate-[-2deg] text-center text-2xl text-ink-soft/80">
          share a snapshot of your world — one tap ✦
        </p>
      </Reveal>
    </div>
  )
}
```

- [ ] **Step 4: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/OwnershipGrid.tsx apps/web/components/marketing/MiniGraph.tsx apps/web/components/marketing/PaletteShowcase.tsx
git commit -m "feat(landing): ownership 2x2 grid + palette showcase (blocks 6-7)"
```

Header copy for these blocks (rendered via `Statement` in Task 11):
- Block 6 — kicker: `Your data, actually yours`, color `#4ade80`, title: `Stop being the product.`, body: `Every app profiles you in the dark. Hype does the opposite — the profile is the product, and it belongs to you.`
- Block 7 — kicker: `Make it yours`, color `#f472b6`, title: `A graph that looks like you.`, body: `Four palettes, your colors, your constellation. Share a snapshot of your world with one tap — it's the prettiest thing your camera roll has seen all week.`

---

### Task 9: Steps + TheCatch (blocks 8–9)

**Files:**
- Create: `components/marketing/Steps.tsx`
- Create: `components/marketing/TheCatch.tsx`

**Interfaces:**
- Consumes: `Reveal`, tokens.
- Produces: `<Steps />`, `<TheCatch />` (no props).

- [ ] **Step 1: Create `Steps.tsx`**

```tsx
import Reveal from "./Reveal"

// Block 8 — Portal's numbered 1–6 walkthrough, as the Hype journey. Step numbers
// cycle through real graph topic colors.
const STEPS: { color: string; title: string; body: string }[] = [
  { color: "#a78bfa", title: "Join the waitlist", body: "Drop your email below. We're inviting a small first group, personally." },
  { color: "#60a5fa", title: "Say hello", body: "A two-minute onboarding: where you're based, what fills your days. Your first two nodes appear as you answer." },
  { color: "#4ade80", title: "Talk, and watch it bloom", body: "Every conversation adds people, places, and passions to your map. This part is dangerously satisfying." },
  { color: "#67e8f9", title: "It starts giving back", body: "Recall, reminders, reflections — your graph begins working for you within days." },
  { color: "#f472b6", title: "Say yes to a find (or don't)", body: "When Hype spots something genuinely worth showing you, it asks. You decide. Every time." },
  { color: "#fbbf24", title: "Yours forever", body: "Export your vault whenever you like. Hype earns your stay — it never locks you in." },
]

export default function Steps() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6">
      {STEPS.map((s, i) => (
        <Reveal key={s.title} delay={i * 60} className="flex items-start gap-5">
          <span
            className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-ink"
            style={{ backgroundColor: `${s.color}33`, boxShadow: `0 0 0 1px ${s.color}66 inset` }}
          >
            {i + 1}
          </span>
          <span>
            <span className="font-display block text-lg font-bold text-ink">{s.title}</span>
            <span className="font-body mt-1 block leading-relaxed text-ink-soft">{s.body}</span>
          </span>
        </Reveal>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `TheCatch.tsx`**

Copy is canon-sensitive — verbatim, no paraphrasing.

```tsx
import Reveal from "./Reveal"

// Block 9 — Portal's "Pricing? Glad you asked." as the business-model straight talk.
// Canon guard: free is stated as fact, never as a trade ("free because…" is banned).
export default function TheCatch() {
  return (
    <div className="mx-auto max-w-2xl px-6">
      <Reveal className="rounded-2xl border border-ink/10 bg-card p-8 shadow-[0_16px_48px_-20px_rgba(33,26,18,0.25)] sm:p-10">
        <p className="font-body text-pretty text-lg leading-relaxed text-ink">
          Hype is free — no card, no trial clock, no premium wall.
        </p>
        <p className="font-body mt-4 text-pretty leading-relaxed text-ink-soft">
          Here's the business model, in full: when you say yes to a find and it leads
          to a purchase, the brand pays us a referral fee. That's it. Brands get a
          click — never your data. Your graph never leaves Hype, not in any form, not
          ever.
        </p>
        <p className="font-body mt-4 text-pretty leading-relaxed text-ink-soft">
          And since we only earn when a find is worth your yes, every incentive we
          have points at showing you fewer, better things.
        </p>
        <p className="font-hand mt-6 rotate-[-1.5deg] text-2xl text-ink">
          No yes, no fee. The whole model in five words.
        </p>
      </Reveal>
    </div>
  )
}
```

- [ ] **Step 3: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/Steps.tsx apps/web/components/marketing/TheCatch.tsx
git commit -m "feat(landing): 6-step journey + business-model straight talk (blocks 8-9)"
```

Header copy (rendered via `Statement` in Task 11):
- Block 8 — kicker: `From hello to home screen`, color `#60a5fa`, title: `Here's how it goes.`
- Block 9 — kicker: `The deal`, color `#fbbf24`, `id="the-deal"`, title: `What's the catch? Glad you asked.`

---

### Task 10: FounderMemo + Footer (blocks 10–11)

**Files:**
- Create: `components/marketing/FounderMemo.tsx`
- Create: `components/marketing/Footer.tsx`

**Interfaces:**
- Consumes: `Reveal`, `WaitlistForm` (Task 3), `Constellation` (Task 4), `.night-sky` (Task 2).
- Produces: `<FounderMemo />`, `<Footer />` (no props). Footer contains the `#join` anchor target used by SiteNav and Steps.

- [ ] **Step 1: Create `FounderMemo.tsx`**

The letter is a **draft in the owner's voice — flagged for his rewrite before deploy** (spec §9). Ship it as written; do not improvise different copy.

```tsx
import Reveal from "./Reveal"

// Block 10 — Portal's founder memo. DRAFT letter: owner rewrites before deploy (spec §9).
export default function FounderMemo() {
  return (
    <div className="mx-auto max-w-2xl px-6">
      <Reveal className="rounded-2xl border border-ink/10 bg-card p-8 shadow-[0_16px_48px_-20px_rgba(33,26,18,0.25)] sm:p-10">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-ink-soft">Founder memo</p>
        <div className="font-body mt-6 space-y-4 text-pretty leading-relaxed text-ink">
          <p>
            The graph at the top of this page started as a question I couldn't shake:
            why does every app in my life know something about me, while the one thing
            that never exists is a memory that's actually <em>mine</em>?
          </p>
          <p>
            I'm building Hype alone — design, code, and the occasional 2am bug. What I
            want is simple to say and hard to build: an AI you talk to like a friend,
            that remembers like one, and that answers to you and nobody else. The graph
            is the whole deal — everything it knows, drawn where you can see it,
            correct it, or delete it.
          </p>
          <p>
            If you join the beta, you're not a growth metric. You're one of the first
            twenty people whose feedback decides what this becomes. You'll have my
            email, and I'll actually reply.
          </p>
          <p>Come build a memory with me.</p>
        </div>
        <p className="font-hand mt-8 text-4xl text-ink">Joshua</p>
        <p className="font-body mt-1 text-sm text-ink-soft">Founder of Hype</p>
      </Reveal>
    </div>
  )
}
```

- [ ] **Step 2: Create `Footer.tsx`**

```tsx
import Constellation from "./Constellation"
import WaitlistForm from "./WaitlistForm"
import Reveal from "./Reveal"

// Block 11 — the night returns: closing CTA over the constellation, then footer links.
export default function Footer() {
  return (
    <footer className="night-sky relative overflow-hidden">
      <span id="join" className="absolute top-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] opacity-50">
        <Constellation fill className="h-full w-full" />
      </div>
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-40 pt-24 text-center sm:pt-32">
        <Reveal className="flex flex-col items-center">
          <h2 className="font-display text-balance text-[clamp(2.2rem,6vw,3.75rem)] font-extrabold leading-[1.03] tracking-[-0.02em] text-star">
            Be one of the first.
          </h2>
          <p className="font-body mt-5 max-w-md text-pretty leading-relaxed text-star/70">
            Hype is opening to a small group of beta testers. Leave your email and
            I&apos;ll personally send you an invite.
          </p>
          <div className="mt-8 flex w-full justify-center">
            <WaitlistForm />
          </div>
        </Reveal>
      </div>
      <div className="relative border-t border-white/10">
        <div className="font-body mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-star/50">
          <span>© 2026 Hype</span>
          <a href="mailto:mendella.joshua@gmail.com" className="transition-colors hover:text-star">Contact</a>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Build check + commit**

```bash
cd apps/web && pnpm build
git add apps/web/components/marketing/FounderMemo.tsx apps/web/components/marketing/Footer.tsx
git commit -m "feat(landing): founder memo + night-sky footer CTA (blocks 10-11)"
```

---

### Task 11: Assemble Landing, switch over, delete old page, purge dead CSS

**Files:**
- Modify: `components/marketing/Landing.tsx` (full rewrite — keeps its path so `app/page.tsx` is untouched)
- Delete: `components/marketing/ConsentPanel.tsx`, `TalkDemo.tsx`, `GrowthTimeline.tsx`, `PhoneMock.tsx`, `Thread.tsx`, `ThemeToggle.tsx`, `Nav.tsx`, `DemoGraph.tsx`
- Modify: `app/globals.css` (purge CSS only the deleted components used)

**Interfaces:**
- Consumes: every component from Tasks 3–10, `Statement` with the header copy recorded in Tasks 6–9.

- [ ] **Step 1: Rewrite `Landing.tsx`**

```tsx
import SiteNav from "./SiteNav"
import Hero from "./Hero"
import Statement from "./Statement"
import IconGrid from "./IconGrid"
import DeepDives from "./DeepDives"
import OwnershipGrid from "./OwnershipGrid"
import PaletteShowcase from "./PaletteShowcase"
import Steps from "./Steps"
import TheCatch from "./TheCatch"
import FounderMemo from "./FounderMemo"
import Footer from "./Footer"

// Portal-style landing — 11 blocks, dusk→day→night.
// Spec: docs/superpowers/specs/2026-07-13-landing-portal-style-design.md
export default function Landing() {
  return (
    <div className="landing bg-paper">
      <SiteNav />
      <Hero />

      {/* pt compensates the hero app-card's negative bottom margin */}
      <section className="pt-44 sm:pt-56">
        <Statement kicker="Why Hype exists" color="#a78bfa" title="You've told a hundred apps who you are. Not one of them was listening.">
          <p>
            Your music app knows your playlists. Your maps app knows your commute.
            Your shopping app knows your size. Each one holds a sliver of you, none of
            them talk to each other — and not one could tell you your best friend&apos;s
            birthday.
          </p>
          <p>
            Hype starts from the opposite end: one genuine conversation at a time, it
            learns your world the way a friend would — and keeps it in a graph you can
            actually see. Not for our benefit. For yours.
          </p>
        </Statement>
      </section>

      <section className="pt-20 sm:pt-24">
        <IconGrid />
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement id="how-it-works" kicker="What you get" color="#2dd4bf" title="A memory you can watch being made.">
          <p>Four things happen when you talk to Hype. Here&apos;s each one, up close.</p>
        </Statement>
        <div className="pt-16 sm:pt-24">
          <DeepDives />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="Your data, actually yours" color="#4ade80" title="Stop being the product.">
          <p>Every app profiles you in the dark. Hype does the opposite — the profile is the product, and it belongs to you.</p>
        </Statement>
        <div className="pt-12 sm:pt-16">
          <OwnershipGrid />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="Make it yours" color="#f472b6" title="A graph that looks like you.">
          <p>
            Four palettes, your colors, your constellation. Share a snapshot of your
            world with one tap — it&apos;s the prettiest thing your camera roll has seen
            all week.
          </p>
        </Statement>
        <div className="pt-12 sm:pt-16">
          <PaletteShowcase />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="From hello to home screen" color="#60a5fa" title="Here's how it goes." />
        <div className="pt-12 sm:pt-16">
          <Steps />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement id="the-deal" kicker="The deal" color="#fbbf24" title="What's the catch? Glad you asked." />
        <div className="pt-12 sm:pt-16">
          <TheCatch />
        </div>
      </section>

      <section className="pb-28 pt-28 sm:pb-36 sm:pt-36">
        <FounderMemo />
      </section>

      <Footer />
    </div>
  )
}
```

- [ ] **Step 2: Delete the old components**

```bash
git rm apps/web/components/marketing/ConsentPanel.tsx apps/web/components/marketing/TalkDemo.tsx apps/web/components/marketing/GrowthTimeline.tsx apps/web/components/marketing/PhoneMock.tsx apps/web/components/marketing/Thread.tsx apps/web/components/marketing/ThemeToggle.tsx apps/web/components/marketing/Nav.tsx apps/web/components/marketing/DemoGraph.tsx
```

- [ ] **Step 3: Purge dead CSS from `globals.css`**

Before deleting each item below, grep to confirm it has no remaining consumer (`grep -rn "<name>" apps/web/components apps/web/app`). Expected safe to delete (all consumers died in Step 2):
- `.graph-ink`, `.amber-ink`, `@keyframes ink-pan`
- `.offer-in`, `@keyframes offer-in`
- `.thread-converge-dot`, `.thread-bloom`, `.node-bud`, `.cta-breathe-target` + their `@keyframes` (`thread-converge`, `thread-bloom`, `thread-breathe`, `node-bud`)
- The entire light-theme block: `@custom-variant light`, both `[data-theme="light"]` rule sets, `.graph-dark`
- The `--g-*` variable blocks in `:root` (only DemoGraph/TalkDemo consumed them)
- Old landing tokens `--color-void/--color-mist/--color-edge/--color-ask/--color-you-*` — **only if** the grep for `void|mist|edge|-ask|you-green|you-blue|you-purple|you-pink` class usage comes back empty after Step 2
- Update the corresponding entries in the `prefers-reduced-motion` block (keep `.reveal`, `.hype-float`, `.hero-in` lines; drop the deleted ones)

Keep: `.landing` font scope, `.reveal`, `.hype-float`, `.hero-in`, the new dusk/night/paper tokens and sky classes.

- [ ] **Step 4: Full verification**

```bash
cd apps/web && pnpm build
```
Expected: green, no unused-import or module-not-found errors.

Lexicon sweep — user-facing copy must never say "ad(s)"/"advertising":

```bash
grep -rniE "\bads?\b|advertis" apps/web/components/marketing/
```
Expected: **no matches** (comments included in these files are also written clean; if a match appears, fix the copy, don't relax the check).

Visual pass on `pnpm dev` → `http://localhost:3000`:
1. All 11 blocks render in order; dusk → paper → night arc reads.
2. Nav anchors scroll to `#how-it-works`, `#the-deal`, `#join`; sticky nav doesn't cover section headings.
3. Both waitlist forms submit successfully (clean up test rows via `mcp__supabase__execute_sql` afterwards).
4. Mobile viewport (~390px): no horizontal scroll, hero headline wraps cleanly, icon grid stacks to one column, deep-dive rows stack visual-above-copy.
5. OS reduced-motion (or DevTools emulation): page renders fully with no invisible content.
6. `/login` and `/graph` still work (font scope + CSS purge must not leak outside the landing).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(landing): Portal-style 11-block page live — old landing removed, dead CSS purged"
```

---

## Post-plan (owner, before deploy — not tasks for the implementer)

1. Rewrite/approve the founder-memo letter (Task 10 ships a draft).
2. Capture a real graph-screen screenshot → `public/app-shot.png`, swap into the Hero app-card.
3. Copy review of headlines/statements.
4. Contact email in `Footer.tsx` is the owner's personal Gmail — confirm he's comfortable with that on a public page, or set up an alias.

## Self-review notes

- Spec coverage: blocks 1–11 → Tasks 5 (1–2), 6 (3–4), 7 (5), 8 (6–7), 9 (8–9), 10 (10–11), assembled in 11; waitlist backend → Task 1; tokens/arc → Task 2; form → Task 3; constellation → Task 4; screenshot placeholder + owner-input list → Hero card + post-plan section; old-file deletion + green-build constraint → Task 11 + global constraints. No gaps found.
- All copy is final and inline; no TBDs.
- Cross-task names checked: `WaitlistForm` (3→5,10), `Constellation` (4→5,10), `Statement` (6→11), anchors `#how-it-works`/`#the-deal`/`#join` (5→11,10).

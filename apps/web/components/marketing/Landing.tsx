import Link from "next/link"
import Nav from "./Nav"
import DemoGraph from "./DemoGraph"
import Reveal from "./Reveal"
import ConsentPanel from "./ConsentPanel"
import TalkDemo from "./TalkDemo"
import GrowthTimeline from "./GrowthTimeline"
import PhoneMock from "./PhoneMock"

// Server component — static composition; the interactive/animated pieces are their own
// client components. Colors trace back to the app's real TOPIC_COLORS (see demoGraph.ts).

function Eyebrow({ color, light, children }: { color: string; light: string; children: React.ReactNode }) {
  return (
    <p
      className="text-xs font-medium uppercase tracking-[0.25em] text-[var(--eb)] light:text-[var(--eb-l)]"
      style={{ ["--eb" as string]: color, ["--eb-l" as string]: light }}
    >
      {children}
    </p>
  )
}

export default function Landing() {
  return (
    <div className="font-body min-h-screen bg-[#0a0a0a] text-white transition-colors duration-300 light:bg-[#f6f5f2] light:text-[#141414] [font-family:var(--font-inter)]">
      <Nav />

      {/* ── 1 · Hero ──────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        {/* The graph fills the whole hero — it IS the product */}
        <div className="absolute inset-0 -z-10">
          <DemoGraph fill spread={2.1} className="h-full w-full" />
        </div>
        {/* Legibility scrim sits behind the text only; the edges stay clear so the graph glows around it */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_46%_42%_at_center,rgba(10,10,10,0.92)_0%,rgba(10,10,10,0.55)_55%,transparent_100%)] light:bg-[radial-gradient(ellipse_46%_42%_at_center,rgba(246,245,242,0.9)_0%,rgba(246,245,242,0.45)_55%,transparent_100%)]" />
        {/* Fade into the next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-[#0a0a0a] light:to-[#f6f5f2]" />

        <div className="max-w-3xl">
          <Link
            href="#consent"
            className="hero-in inline-flex items-center gap-2 rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/[0.08] px-4 py-1.5 text-xs font-medium text-[#fbbf24] shadow-[0_0_30px_-10px_rgba(251,191,36,0.7)] transition-colors hover:bg-[#fbbf24]/[0.14] light:border-[#b45309]/30 light:bg-[#fbbf24]/[0.15] light:text-[#b45309]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
            The first assistant with consent-only ads
          </Link>

          <h1
            className="hero-in font-display mt-6 text-[clamp(2.75rem,7.5vw,6rem)] font-semibold leading-[1.02] tracking-[-0.03em]"
            style={{ ["--hero-delay" as string]: "120ms" }}
          >
            An assistant that
            <br />
            learns you <span className="graph-ink">by heart</span>.
          </h1>

          <p
            className="hero-in mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/65 light:text-black/60"
            style={{ ["--hero-delay" as string]: "260ms" }}
          >
            Talk to Hype like a friend. It builds a living map of your world — the people,
            places, and things that make you <span className="italic text-white/85 light:text-black/80">you</span> —
            and remembers all of it.
          </p>

          <div
            className="hero-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ ["--hero-delay" as string]: "400ms" }}
          >
            <Link
              href="/signup"
              className="w-full rounded-xl bg-white px-8 py-4 text-base font-semibold text-black shadow-[0_0_50px_-8px_rgba(255,255,255,0.7)] transition-transform hover:scale-[1.03] light:bg-[#141414] light:text-white light:shadow-[0_14px_40px_-12px_rgba(0,0,0,0.45)] sm:w-auto"
            >
              Try Hype free
            </Link>
            <Link
              href="#how"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-8 py-4 text-base font-medium text-white/80 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white light:border-black/15 light:bg-white/50 light:text-black/70 light:hover:border-black/30 light:hover:text-black sm:w-auto"
            >
              See how it works
            </Link>
          </div>

          <p
            className="hero-in mt-8 text-xs text-white/40 light:text-black/50"
            style={{ ["--hero-delay" as string]: "540ms" }}
          >
            Free forever · You see everything it knows · Delete it all, anytime
          </p>
        </div>
      </section>

      {/* ── 2 · Consent-only ads (flagship) ───────────────────── */}
      <section id="consent" className="relative isolate overflow-hidden border-t border-white/5 light:border-black/5">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(251,191,36,0.18),transparent)]" />
        <div className="pointer-events-none absolute -left-40 top-1/2 -z-10 h-96 w-96 rounded-full bg-[#fbbf24]/[0.06] blur-3xl" />
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <Reveal className="mx-auto max-w-3xl text-center">
            <Eyebrow color="#fbbf24" light="#b45309">The big deal</Eyebrow>
            <h2 className="font-display mt-4 text-[clamp(2.25rem,5.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              The first assistant with <span className="amber-ink">consent-only ads</span>.
            </h2>
            <p className="mt-5 text-lg text-white/60 light:text-black/60">
              A new way of doing ads: Hype asks before it shows you anything. The most relevant
              offers you&apos;ll ever see — and you said yes to every one.
            </p>
          </Reveal>

          <Reveal className="mt-12" delay={80}>
            <ConsentPanel />
          </Reveal>

          <Reveal className="mt-12 grid gap-6 sm:grid-cols-3" delay={120}>
            {[
              { i: "◎", h: "Hyper-tailored", b: "Because it genuinely knows you, its offers are relevant in a way generic ad-tech can't touch. No creepy guesswork." },
              { i: "✋", h: "Consent-only", b: "Nothing is ever pushed. Hype asks first, every time — say yes and the offer appears, say no and the conversation just moves on." },
              { i: "◉", h: "Fully in the open", b: "It's your graph. You see everything it knows, switch any of it off, and that transparency is why it's free." },
            ].map((c) => (
              <div
                key={c.h}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#fbbf24]/30 hover:bg-[#fbbf24]/[0.04] light:border-black/10 light:bg-white light:hover:border-[#b45309]/30"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fbbf24]/10 text-base text-[#fbbf24] light:bg-[#fbbf24]/20 light:text-[#b45309]">
                  {c.i}
                </span>
                <h3 className="font-display mt-4 text-lg font-semibold text-white light:text-[#141414]">{c.h}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55 light:text-black/55">{c.b}</p>
              </div>
            ))}
          </Reveal>

          {/* Old model vs Hype — the contrast IS the pitch */}
          <Reveal className="mt-14 grid gap-4 sm:grid-cols-2" delay={160}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 opacity-75 light:border-black/10 light:bg-black/[0.03]">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35 light:text-black/40">
                Ads everywhere else — Instagram, Netflix, YouTube
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "Interrupt the feed, the show, the video — right in the middle of what you came for",
                  "Targeted by tracking you around the internet and guessing",
                  "Shown whether you care or not — there is no “no”",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-white/50 light:text-black/50">
                    <span className="mt-0.5 text-white/30 light:text-black/30">✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#fbbf24]/25 bg-[#fbbf24]/[0.04] p-6 light:border-[#b45309]/25 light:bg-[#fbbf24]/[0.1]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#fbbf24] light:text-[#b45309]">Ads on Hype</p>
              <ul className="mt-4 space-y-3">
                {[
                  "Never interrupt — the offer only exists after you say yes",
                  "Drawn from what you actually told it, not from surveillance",
                  "Hyper-tailored to the moment: deals on running shoes when yours wear out, not whenever",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm leading-relaxed text-white/75 light:text-black/70">
                    <span className="mt-0.5 text-[#fbbf24] light:text-[#b45309]">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal className="mx-auto mt-12 max-w-2xl text-center" delay={200}>
            <p className="text-white/60 light:text-black/60">
              No hidden tracking, no ads chasing you around the internet.{" "}
              <span className="text-white light:text-[#141414]">Nobody else does this.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 3 · Just talk ─────────────────────────────────────── */}
      <section id="how" className="border-t border-white/5 light:border-black/5">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <Reveal className="max-w-2xl">
            <Eyebrow color="#60a5fa" light="#2563eb">No forms. Ever.</Eyebrow>
            <h2 className="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Stop keeping it all in your head.
            </h2>
            <p className="mt-5 text-lg text-white/60 light:text-black/60">
              The people, plans, and things you&apos;re trying to remember don&apos;t belong in
              your head. Just talk to Hype like a friend — no setup, no forms, no tags — and it
              quietly turns what you say into a map you can actually see.
            </p>
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <TalkDemo />
          </Reveal>
        </div>
      </section>

      {/* ── 4 · Second brain ──────────────────────────────────── */}
      <section className="border-t border-white/5 light:border-black/5 bg-white/[0.015] light:bg-black/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <Reveal className="max-w-2xl">
            <Eyebrow color="#4ade80" light="#15803d">Your second brain</Eyebrow>
            <h2 className="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Never lose a recommendation again.
            </h2>
            <p className="mt-5 text-lg text-white/60 light:text-black/60">
              That restaurant a friend swore by, the gift idea you had in March, the book you meant
              to read — it&apos;s all still here, searchable. Come back anytime to explore what you
              told it, watch new connections form, and see yourself grow, one node at a time.
            </p>
          </Reveal>
          <Reveal className="mt-12" delay={100}>
            <GrowthTimeline />
          </Reveal>
        </div>
      </section>

      {/* ── 5 · Proactive notifications ───────────────────────── */}
      <section className="border-t border-white/5 light:border-black/5">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-24 sm:grid-cols-2 sm:py-32">
          <Reveal>
            <Eyebrow color="#22d3ee" light="#0e7490">It reaches out to you</Eyebrow>
            <h2 className="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              It remembers, so it can remind you.
            </h2>
            <p className="mt-5 text-lg text-white/60 light:text-black/60">
              Life moves fast and you&apos;ll forget to check in — so Hype checks in with you. A
              quick, friendly nudge keeps your world current, and when something you told it you
              wanted is worth a look, it lets you know. You decide what&apos;s worth a ping; it
              never nags.
            </p>
          </Reveal>

          {/* Phone lock-screen with two notifications */}
          <Reveal delay={120} className="flex justify-center">
            {/* The phone stays dark in light mode — the app itself is dark, and that's the honest shot */}
            <div className="w-full max-w-[300px] rounded-[2.2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-3 shadow-2xl light:border-black/15 light:from-black/[0.06]">
              <div className="rounded-[1.7rem] bg-black/60 p-5 light:bg-[#101014]">
                <p className="text-center font-display text-5xl font-semibold text-white/90">9:41</p>
                <p className="mb-6 text-center text-xs text-white/40">Tuesday, May 14</p>
                <div className="space-y-3">
                  {[
                    { t: "now", title: "Got two minutes?", body: "Tell me about your weekend — I'll keep your graph current." },
                    { t: "2m ago", title: "Early-bird closes Friday", body: "That marathon you mentioned — entry's open.", tag: "you said yes" },
                  ].map((n) => (
                    <div key={n.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                          <span className="h-3.5 w-3.5 rounded-[5px] bg-gradient-to-br from-[#22d3ee] to-[#60a5fa]" />
                          Hype
                        </span>
                        <span className="text-[10px] text-white/35">{n.t}</span>
                      </div>
                      <p className="text-sm font-medium text-white/90">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-snug text-white/55">{n.body}</p>
                      {n.tag && (
                        <span className="mt-2 inline-block rounded-md bg-[#fbbf24]/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#fbbf24]">
                          {n.tag}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 6 · Download / daily companion ────────────────────── */}
      <section className="border-t border-white/5 light:border-black/5 bg-white/[0.015] light:bg-black/[0.02]">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-24 sm:grid-cols-2 sm:py-32">
          <Reveal className="order-2 sm:order-1 flex justify-center">
            <PhoneMock />
          </Reveal>

          <Reveal className="order-1 sm:order-2" delay={80}>
            <Eyebrow color="#a855f7" light="#7e22ce">Everyday companion</Eyebrow>
            <h2 className="font-display mt-4 text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Your assistant, in your pocket.
            </h2>
            <p className="mt-5 text-lg text-white/60 light:text-black/60">
              Hype is built to live in your pocket — a two-minute chat on the bus, a glance at your
              graph over coffee. The iOS and Android apps are on the way. Start on the web today and
              your graph comes with you when they land.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {["iOS", "Android"].map((p) => (
                <span
                  key={p}
                  className="inline-flex cursor-default items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white/50 light:border-black/15 light:bg-black/[0.04] light:text-black/55"
                >
                  {p}
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/45 light:bg-black/10 light:text-black/50">
                    Soon
                  </span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 7 · Closing CTA ───────────────────────────────────── */}
      <section className="relative isolate overflow-hidden border-t border-white/5 light:border-black/5">
        <div className="absolute inset-0 -z-20 opacity-40 light:opacity-70">
          <DemoGraph fill spread={2.1} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_60%_at_center,rgba(10,10,10,0.9)_0%,rgba(10,10,10,0.6)_60%,transparent_100%)] light:bg-[radial-gradient(ellipse_50%_60%_at_center,rgba(246,245,242,0.88)_0%,rgba(246,245,242,0.5)_60%,transparent_100%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(255,255,255,0.1),transparent)] light:bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(0,0,0,0.06),transparent)]" />
        <div className="mx-auto max-w-3xl px-6 py-28 text-center sm:py-36">
          <Reveal>
            <h2 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.03] tracking-[-0.03em]">
              Start building <span className="graph-ink">your graph</span>.
            </h2>
            <p className="mt-5 text-lg text-white/55 light:text-black/55">Free to use. Yours to control.</p>
            <Link
              href="/signup"
              className="mt-9 inline-block rounded-xl bg-white px-9 py-4 text-base font-semibold text-black shadow-[0_0_60px_-8px_rgba(255,255,255,0.8)] transition-transform hover:scale-[1.03] light:bg-[#141414] light:text-white light:shadow-[0_14px_40px_-12px_rgba(0,0,0,0.45)]"
            >
              Try Hype free
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/5 light:border-black/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-white/40 light:text-black/50 sm:flex-row">
          <span className="font-display text-base font-semibold text-white/70 light:text-black/80">Hype</span>
          <span className="text-center">Be in control of your ads. Only see what you want, when you want it.</span>
          <div className="flex gap-5">
            <Link href="/login" className="transition-colors hover:text-white/70 light:hover:text-black">Sign in</Link>
            <Link href="#" className="transition-colors hover:text-white/70 light:hover:text-black">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

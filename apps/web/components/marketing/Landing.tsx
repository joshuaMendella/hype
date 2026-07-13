import Link from "next/link"
import Nav from "./Nav"
import DemoGraph from "./DemoGraph"
import Reveal from "./Reveal"
import ConsentPanel from "./ConsentPanel"
import TalkDemo from "./TalkDemo"
import GrowthTimeline from "./GrowthTimeline"
import Thread from "./Thread"

// Server component — static composition; the interactive/animated pieces are their own
// client components. Colors trace back to the app's real TOPIC_COLORS (see graphData.ts).
// Narrative arc: you talk → it draws you → it asks → it gives back. The Thread (a client
// component) runs down the whole page as the scroll spine; each section drops an invisible
// `data-thread-node` anchor near its kicker so Thread can find it, draw to it, and light it.
// Rhythm: full-bleed → contained → full-bleed → GOLD full-bleed → contained(mirrored) →
// full-bleed minimal. Amber (#fbbf24) is reserved for the asking section + Thread flood only —
// every other accent below is a you-spectrum hue (green/blue/purple/pink).

function Kicker({
  color,
  tone = "light",
  center = false,
  amber = false,
  children,
}: {
  color: string
  tone?: "light" | "dark"
  center?: boolean
  amber?: boolean
  children: React.ReactNode
}) {
  const dot = amber ? "var(--color-ask)" : color
  return (
    <p
      className={`flex items-center gap-2 font-mono text-[0.8125rem] font-normal uppercase tracking-[0.15em] ${
        center ? "justify-center" : ""
      } ${tone === "dark" ? "text-[#7c4a02]" : "text-mist/55"}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: dot, boxShadow: `0 0 8px 1px ${dot}` }}
      />
      {children}
    </p>
  )
}

// Zero-size marker Thread.tsx locates via querySelectorAll — contributes no layout, just a Y anchor.
function ThreadAnchor({ id, color, amber }: { id: string; color: string; amber?: boolean }) {
  return (
    <span
      data-thread-node={id}
      data-thread-color={color}
      data-thread-amber={amber ? "true" : undefined}
      className="block h-0 w-0 overflow-hidden"
      aria-hidden="true"
    />
  )
}

export default function Landing() {
  return (
    <div className="landing relative min-h-screen bg-void font-body text-mist transition-colors duration-300 light:bg-[#f6f5f2] light:text-[#141414] [font-family:var(--font-body)]">
      <Thread />
      <Nav />

      {/* ── 1 · Hero — full-bleed, live. Graph owns the upper two-thirds; text sits
          lower-left. Thread is born here. ── */}
      <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden px-6 pb-20 pt-32 sm:px-12 sm:pb-28 lg:px-20">
        <div className="absolute inset-0 -z-10">
          <DemoGraph fill spread={2.2} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(10,11,15,0.94)_0%,rgba(10,11,15,0.5)_42%,transparent_72%)] light:bg-[linear-gradient(to_top,rgba(246,245,242,0.94)_0%,rgba(246,245,242,0.5)_42%,transparent_72%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-void light:to-[#f6f5f2]" />

        <ThreadAnchor id="hero" color="#4ADE80" />

        <div className="max-w-xl">
          <Kicker color="#4ADE80">you</Kicker>

          <h1
            className="hero-in font-display mt-5 text-[clamp(3.5rem,9vw,7.5rem)] font-extrabold leading-[0.98] tracking-[-0.02em]"
            style={{ ["--hero-delay" as string]: "120ms" }}
          >
            It learns <span className="graph-ink">you</span>.
            <br />
            So it knows what you&apos;re after.
          </h1>

          <p
            className="hero-in mt-6 max-w-md text-[1.25rem] leading-relaxed text-mist/70 light:text-black/65"
            style={{ ["--hero-delay" as string]: "300ms" }}
          >
            No one has ever asked you this before.
          </p>

          {/* Three you-spectrum nodes light in sequence under the headline. */}
          <div className="mt-5 flex gap-2.5">
            {["#4ADE80", "#60A5FA", "#A78BFA"].map((c, i) => (
              <span
                key={c}
                className="hero-in h-2 w-2 rounded-full"
                style={{
                  background: c,
                  boxShadow: `0 0 10px 2px ${c}`,
                  ["--hero-delay" as string]: `${480 + i * 180}ms`,
                }}
              />
            ))}
          </div>

          <div
            className="hero-in mt-8 flex flex-col items-start gap-3 sm:flex-row"
            style={{ ["--hero-delay" as string]: "620ms" }}
          >
            <Link
              href="/signup"
              className="w-full rounded-xl bg-mist px-8 py-4 text-base font-semibold text-void shadow-[0_0_50px_-8px_rgba(231,233,238,0.6)] transition-transform hover:scale-[1.03] light:bg-[#141414] light:text-white light:shadow-[0_14px_40px_-12px_rgba(0,0,0,0.45)] sm:w-auto"
            >
              Try Hype free
            </Link>
            <Link
              href="#how"
              className="w-full rounded-xl border border-edge bg-void/40 px-8 py-4 text-base font-medium text-mist/80 backdrop-blur-sm transition-colors hover:border-mist/30 hover:text-mist light:border-black/15 light:bg-white/50 light:text-black/70 light:hover:border-black/30 light:hover:text-black sm:w-auto"
            >
              See how it works
            </Link>
          </div>

          <p
            className="hero-in mt-7 text-xs text-mist/40 light:text-black/50"
            style={{ ["--hero-delay" as string]: "760ms" }}
          >
            Free forever · You see everything it knows · Delete it all, anytime
          </p>
        </div>
      </section>

      {/* ── 2 · Conversation — contained. Hard break: a lifted surface (#12141A) on a
          640px column. The zoom from full-bleed to box is the first jolt. Text-left, chat
          right; a small node buds off inside TalkDemo as each fact lands. ── */}
      <section id="how" className="relative bg-void py-24 light:bg-[#f6f5f2] sm:py-32">
        <div className="mx-auto max-w-[760px] px-6">
          <Reveal>
            <div className="relative rounded-[2rem] border border-edge bg-[#12141A] p-8 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.7)] light:border-black/10 light:bg-white light:shadow-[0_30px_70px_-32px_rgba(0,0,0,0.18)] sm:p-12">
              <ThreadAnchor id="talk" color="#60A5FA" />
              <div className="grid gap-10 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
                <div className="text-left">
                  <Kicker color="#60A5FA">just talk</Kicker>
                  <h2 className="font-display mt-4 text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em]">
                    No forms.
                    <br />
                    Just talk.
                  </h2>
                  <p className="mt-5 text-[1.25rem] leading-relaxed text-mist/60 light:text-black/60">
                    You talk. It remembers. Nothing to file, ever.
                  </p>
                </div>
                <TalkDemo />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 3 · Graph grows — full-bleed, interactive. Breathe back out: the real graph
          large and centered, with the week slider. ── */}
      <section className="relative border-t border-edge bg-void py-24 light:border-black/5 light:bg-[#f6f5f2] sm:py-32">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <Reveal>
            <ThreadAnchor id="grow" color="#A78BFA" />
            <Kicker color="#A78BFA" center>week by week</Kicker>
            <h2 className="font-display mt-4 text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              Watch yourself take shape.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-[1.25rem] leading-relaxed text-mist/60 light:text-black/60">
              The more you say, the more it becomes you.
            </p>
          </Reveal>
        </div>
        <Reveal className="mx-auto mt-14 max-w-5xl px-4 sm:px-6" delay={100}>
          <GrowthTimeline />
        </Reveal>
      </section>

      {/* ── 4 · THE ASKING — GOLD full-bleed, theme-independent. The Thread arrives amber
          here and every prior node's pulse converges into the gold bloom. ── */}
      <section
        id="consent"
        className="relative isolate overflow-hidden border-y-2 border-black/25 text-[#1a1200] [background:radial-gradient(ellipse_120%_75%_at_50%_-8%,#fde68a_0%,#fbbf24_36%,#f59e0b_100%)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(ellipse_70%_100%_at_50%_0%,rgba(255,255,255,0.35),transparent)]" />

        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <Reveal className="mx-auto max-w-3xl text-center">
            <ThreadAnchor id="asking" color="#FBBF24" amber />
            <Kicker color="#FBBF24" tone="dark" center amber>finds, when you want them</Kicker>
            <h2 className="font-display mt-4 text-[clamp(2.5rem,6.5vw,4.5rem)] font-extrabold leading-[1.0] tracking-[-0.02em] text-[#1a1200]">
              Finds you&apos;ll actually want.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-[1.25rem] leading-relaxed text-[#43300a]">
              Hyper-tailored to what you&apos;ve really shared — and nothing reaches
              you unless you say yes.
            </p>
          </Reveal>

          <Reveal className="mt-14" delay={80}>
            <ConsentPanel />
          </Reveal>

          <Reveal className="mt-14 grid gap-6 sm:grid-cols-3" delay={120}>
            {[
              { i: "◎", h: "Tailored to you", b: "Because it genuinely knows you, what it brings is relevant in a way guesswork can't touch. No creepy tracking." },
              { i: "✋", h: "Only if you ask", b: "Nothing is ever pushed. It asks first, every time — say yes and it appears, say no and the conversation just moves on." },
              { i: "◉", h: "Nothing behind your back", b: "It's your graph. Everything Hype knows sits right in front of you — see it, correct it, delete it. No hidden profile. No guessing how it knew." },
            ].map((c) => (
              <div
                key={c.h}
                className="rounded-2xl border border-black/10 bg-[#100c04] p-6 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:-translate-y-1"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fbbf24]/15 text-base text-[#fbbf24]">
                  {c.i}
                </span>
                <h3 className="font-display mt-4 text-lg font-bold text-white">{c.h}</h3>
                <p className="mt-2 text-[1.0625rem] leading-relaxed text-white/60">{c.b}</p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-14 grid gap-4 sm:grid-cols-2" delay={160}>
            <div className="rounded-2xl border border-black/10 bg-[#100c04]/95 p-6 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                Everywhere else — Instagram, Netflix, YouTube
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "Things you never asked for, dropped in the middle of what you came for",
                  "Guessed at by tracking you around the internet",
                  "Shown whether you want them or not — there is no “no”",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-[1.0625rem] leading-relaxed text-white/55">
                    <span className="mt-0.5 text-white/30">✕</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#fbbf24]/40 bg-[#100c04] p-6 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.7)]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#fbbf24]">With Hype</p>
              <ul className="mt-4 space-y-3">
                {[
                  "Nothing appears until you say yes — it asks, every time",
                  "Drawn from what you actually told it, never from surveillance",
                  "Right for the moment: when your running shoes wear out, not at random",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-[1.0625rem] leading-relaxed text-white/80">
                    <span className="mt-0.5 text-[#fbbf24]">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal className="mx-auto mt-12 max-w-2xl text-center" delay={200}>
            <p className="text-[#43300a]">
              No hidden tracking, nothing chasing you around the internet.{" "}
              <span className="font-semibold text-[#1a1200]">Nobody else does this.</span>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 5 · Gives back — contained, semi-still. MIRROR of §2: phone-left, text-right.
          One proactive nudge, one amber ask-pulse tag arrives, then rests. ── */}
      <section className="relative border-t border-edge bg-void py-24 light:border-black/5 light:bg-[#f6f5f2] sm:py-32">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 sm:grid-cols-2">
          <Reveal className="flex justify-center">
            <div className="w-full max-w-[300px] rounded-[2.2rem] border border-edge bg-gradient-to-b from-mist/[0.06] to-transparent p-3 shadow-2xl light:border-black/15 light:from-black/[0.06]">
              <div className="rounded-[1.7rem] bg-black/60 p-5 light:bg-[#101014]">
                <p className="text-center font-display text-5xl font-bold text-white/90">9:41</p>
                <p className="mb-6 text-center text-xs text-white/40">Tuesday, May 14</p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70">
                      <span className="h-3.5 w-3.5 rounded-[5px] bg-gradient-to-br from-[#A78BFA] to-[#60A5FA]" />
                      Hype
                    </span>
                    <span className="text-[10px] text-white/35">2m ago</span>
                  </div>
                  <p className="text-sm font-medium text-white/90">Worth a look?</p>
                  <p className="mt-0.5 text-xs leading-snug text-white/55">
                    That marathon you mentioned — entry&apos;s open, if you want to see it.
                  </p>
                  <span className="mt-2 inline-block rounded-md bg-ask/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ask">
                    you said yes
                  </span>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100} className="text-left sm:text-right">
            <ThreadAnchor id="remember" color="#F472B6" />
            <Kicker color="#F472B6" center={false}>it remembers for you</Kicker>
            <h2 className="font-display mt-4 text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              It remembers so you don&apos;t.
            </h2>
            <p className="mt-5 text-[1.25rem] leading-relaxed text-mist/60 light:text-black/60">
              Your sister&apos;s birthday, that place in Lisbon — right when you need them.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 6 · CTA — full-bleed, still, minimal. Near-empty void; the Thread descends one
          last time and terminates at the button, which breathes once as it settles into view. ── */}
      <section className="relative isolate overflow-hidden border-t border-edge light:border-black/5">
        <div className="absolute inset-0 -z-20 opacity-25 light:opacity-60">
          <DemoGraph fill spread={2.4} className="h-full w-full" />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_60%_at_center,rgba(10,11,15,0.94)_0%,rgba(10,11,15,0.7)_60%,transparent_100%)] light:bg-[radial-gradient(ellipse_50%_60%_at_center,rgba(246,245,242,0.9)_0%,rgba(246,245,242,0.55)_60%,transparent_100%)]" />
        <div className="mx-auto max-w-2xl px-6 py-28 text-center sm:py-40">
          <Reveal>
            <ThreadAnchor id="cta" color="#4ADE80" />
            <Kicker color="#4ADE80" center>start here</Kicker>
            <h2 className="font-display mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
              Start with <span className="graph-ink">hello</span>.
            </h2>
            <p className="mt-5 text-[1.25rem] text-mist/55 light:text-black/55">
              Free forever. Yours to export — or walk away with — anytime.
            </p>
            <Link
              href="/signup"
              className="cta-breathe-target mt-9 inline-block rounded-xl bg-mist px-9 py-4 text-base font-semibold text-void shadow-[0_0_60px_-8px_rgba(74,222,128,0.5)] transition-transform hover:scale-[1.03] light:bg-[#141414] light:text-white light:shadow-[0_14px_40px_-12px_rgba(0,0,0,0.45)]"
            >
              Try Hype free
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="relative border-t border-edge light:border-black/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-mist/40 light:text-black/50 sm:flex-row">
          <span className="font-display text-base font-bold text-mist/70 light:text-black/80">Hype</span>
          <span className="text-center">No one has ever asked you this before.</span>
          <div className="flex gap-5">
            <Link href="/login" className="transition-colors hover:text-mist/70 light:hover:text-black">Sign in</Link>
            <Link href="#" className="transition-colors hover:text-mist/70 light:hover:text-black">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

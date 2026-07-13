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
        <div key={c.icon} className={`${cardBase} flex items-start gap-3 !p-4`} style={{ transform: `translateX(${i * 24 - 24}px)` }}>
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
        color="#7c3aed"
        title="Just talk. It does the remembering."
        body={<p>Hype asks the kind of questions a good friend would — what you&apos;re into, where you&apos;ve been, what&apos;s coming up. Every answer becomes part of your graph, live, while you watch.</p>}
        visual={<InterviewVisual />}
      />
      <Row
        flip
        kicker="The vault"
        color="#0f766e"
        title="Your memory, in plain text you own."
        body={<p>Behind every node is a simple markdown note — readable by you, editable by you, exportable to Obsidian or anywhere else. No proprietary format, no lock-in. If you ever leave, everything goes with you.</p>}
        visual={<VaultVisual />}
      />
      <Row
        kicker="It gives back"
        color="#0e7490"
        title="The longer it knows you, the more it gives back."
        body={<p>Ask it anything from your own life and it answers from your vault. It remembers the dates you&apos;d feel bad forgetting. And sometimes it holds up a mirror: who were you a year ago?</p>}
        visual={<GiveBackVisual />}
      />
      <Row
        flip
        kicker="Finds"
        color="#db2777"
        title="Finds you'd actually want. Only when you say yes."
        body={
          <>
            <p>When you mention your running shoes are falling apart, Hype asks if you&apos;d like to see a couple of current deals. Say yes and you get one clearly-labeled find, matched to what you actually said.</p>
            <p>Say no and the conversation simply moves on — it never pushes, never sneaks. Only what you want, when you want it.</p>
          </>
        }
        visual={<FindsVisual />}
      />
    </div>
  )
}

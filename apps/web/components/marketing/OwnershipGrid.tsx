import Reveal from "./Reveal"
import type { ReactNode } from "react"

// Block 6 — Portal's 2×2 pain-point grid + wide bottom card, flipped to data ownership.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const

const CELLS: { icon: ReactNode; color: string; title: string; body: string }[] = [
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>, color: "#2563eb", title: "Every fact, visible", body: "The graph is the whole profile. If it's not a node you can see, Hype doesn't know it." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>, color: "#15803d", title: "Correct or delete anything", body: "Wrong city? Old phase? Edit the note or delete the node. Gone means gone." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>, color: "#0e7490", title: "Export everything", body: "One tap gives you the entire vault as plain markdown files." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /><path d="M9 11.5l2 2 4-4" /></svg>, color: "#d97706", title: "It asks first", body: "No find ever appears without your yes — one per conversation, clearly labeled." },
]

export default function OwnershipGrid() {
  return (
    <div className="mx-auto max-w-4xl px-6">
      <div className="grid gap-6 sm:grid-cols-2">
        {CELLS.map((c, i) => (
          <Reveal key={c.title} delay={(i % 2) * 80} className="rounded-2xl border border-ink/10 bg-card p-6 shadow-[0_12px_40px_-20px_rgba(33,26,18,0.2)]">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ color: c.color, backgroundColor: `${c.color}1a`, boxShadow: `0 0 0 1px ${c.color}40 inset` }}
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

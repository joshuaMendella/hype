import Reveal from "./Reveal"
import type { ReactNode } from "react"

// Block 4 — Portal's 8-item colored icon grid. Inline stroke glyphs (no icon lib),
// topic colors darkened for contrast on paper.
const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const

const ITEMS: { icon: ReactNode; color: string; title: string; body: string }[] = [
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg>, color: "#7c3aed", title: "Talk, don't fill forms", body: "No setup, no surveys. Hype interviews you like a curious friend." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M12 3l2.1 6.9L21 12l-6.9 2.1L12 21l-2.1-6.9L3 12l6.9-2.1z" /></svg>, color: "#7e22ce", title: "Watch your graph grow", body: "Every fact becomes a glowing node the moment you share it." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M12 2a7 7 0 0 0-4 12.7c.6.4 1 1.1 1 1.8V18h6v-1.5c0-.7.4-1.4 1-1.8A7 7 0 0 0 12 2z" /><path d="M9 21h6" /></svg>, color: "#4f46e5", title: "Perfect recall", body: "“What was that coffee place in Lisbon?” It knows." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18" /></svg>, color: "#c026d3", title: "It looks ahead", body: "Birthdays, trips, tickets — surfaced before they sneak up on you." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5" /><path d="M12 8v4l3 2" /></svg>, color: "#ca8a04", title: "It reflects with you", body: "“A year ago you were obsessed with film photography. Still?”" },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg>, color: "#db2777", title: "Finds you'd actually want", body: "Hyper-tailored suggestions — only when you say yes." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>, color: "#15803d", title: "Own every fact", body: "See everything it knows. Correct or delete anything, anytime." },
  { icon: <svg viewBox="0 0 24 24" className="h-5 w-5" {...S}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>, color: "#0e7490", title: "Take it anywhere", body: "Plain markdown, Obsidian-compatible. Export with one tap." },
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ color: it.color, backgroundColor: `${it.color}1a`, boxShadow: `0 0 0 1px ${it.color}40 inset` }}
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

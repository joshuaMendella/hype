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

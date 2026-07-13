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

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

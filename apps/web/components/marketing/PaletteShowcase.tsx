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

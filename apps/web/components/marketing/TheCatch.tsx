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

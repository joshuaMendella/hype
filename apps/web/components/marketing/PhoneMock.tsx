import DemoGraph from "./DemoGraph"

// A faithful miniature of the actual app: the graph home screen with the interviewer's
// question floating top-center and the underline answer field at the bottom — the same
// chrome ChatPanel renders, scaled to a phone. Visitors see the real product, not an
// abstract illustration.
export default function PhoneMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-[300px] rounded-[2.6rem] border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-2.5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_60px_-30px_rgba(168,85,247,0.4)] light:border-black/15 light:from-black/[0.06] light:to-black/[0.02] light:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.35),0_0_60px_-30px_rgba(168,85,247,0.3)] ${className}`}
    >
      {/* graph-dark: the app screen stays dark in light mode — it's the real product */}
      <div className="graph-dark relative aspect-[9/19] overflow-hidden rounded-[2rem] bg-[#0d0d0d]">
        {/* The living graph — the app's home screen */}
        <DemoGraph fill className="absolute inset-0 h-full w-full" />

        {/* Status bar + avatar chip */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-3">
          <span className="text-[10px] font-medium text-white/70">9:41</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#60a5fa] text-[10px] font-semibold text-white">
            J
          </span>
        </div>

        {/* AI question — top center, exactly like ChatPanel */}
        <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-6 pb-12 pt-10 text-center">
          <p className="text-[13px] font-light leading-relaxed text-white/90">
            Still running most mornings? How&apos;s the marathon training going?
          </p>
        </div>

        {/* Answer line — bottom, the app's underline input */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-7 pt-12">
          <div className="border-b border-white/25 pb-2 text-left text-[12px] text-white/45">
            your answer…
            <span className="ml-1 inline-block h-3 w-[2px] animate-pulse rounded-full bg-[#a78bfa] align-middle" />
          </div>
        </div>
      </div>
    </div>
  )
}

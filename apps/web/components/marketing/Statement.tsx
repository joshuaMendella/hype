import Reveal from "./Reveal"
import type { ReactNode } from "react"

// Portal-style big statement: mono kicker, display headline, optional body copy.
// Used standalone (block 3) and as the header of blocks 5–9.
export default function Statement({
  kicker,
  color,
  title,
  id,
  children,
}: {
  kicker: string
  color: string
  title: ReactNode
  /** Anchor target (offset above the block so the sticky nav doesn't cover it). */
  id?: string
  children?: ReactNode
}) {
  return (
    <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
      {id && <span id={id} className="absolute -top-24" aria-hidden="true" />}
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em]" style={{ color }}>
        {kicker}
      </p>
      <h2 className="font-display mt-4 text-balance text-[clamp(2rem,5vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
        {title}
      </h2>
      {children && (
        <div className="font-body mx-auto mt-6 max-w-2xl space-y-4 text-pretty text-lg leading-relaxed text-ink-soft">
          {children}
        </div>
      )}
    </Reveal>
  )
}

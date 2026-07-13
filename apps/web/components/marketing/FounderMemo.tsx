import Reveal from "./Reveal"

// Block 10 — Portal's founder memo. DRAFT letter: owner rewrites before deploy (spec §9).
export default function FounderMemo() {
  return (
    <div className="mx-auto max-w-2xl px-6">
      <Reveal className="rounded-2xl border border-ink/10 bg-card p-8 shadow-[0_16px_48px_-20px_rgba(33,26,18,0.25)] sm:p-10">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-ink-soft">Founder memo</p>
        <div className="font-body mt-6 space-y-4 text-pretty leading-relaxed text-ink">
          <p>
            The graph at the top of this page started as a question I couldn&apos;t shake:
            why does every app in my life know something about me, while the one thing
            that never exists is a memory that&apos;s actually <em>mine</em>?
          </p>
          <p>
            I&apos;m building Hype alone — design, code, and the occasional 2am bug. What I
            want is simple to say and hard to build: an AI you talk to like a friend,
            that remembers like one, and that answers to you and nobody else. The graph
            is the whole deal — everything it knows, drawn where you can see it,
            correct it, or delete it.
          </p>
          <p>
            If you join the beta, you&apos;re not a growth metric. You&apos;re one of the first
            twenty people whose feedback decides what this becomes. You&apos;ll have my
            email, and I&apos;ll actually reply.
          </p>
          <p>Come build a memory with me.</p>
        </div>
        <p className="font-hand mt-8 text-4xl text-ink">Joshua</p>
        <p className="font-body mt-1 text-sm text-ink-soft">Founder of Hype</p>
      </Reveal>
    </div>
  )
}

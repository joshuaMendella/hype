import Constellation from "./Constellation"
import WaitlistForm from "./WaitlistForm"

// Block 2 — dusk sky, constellation star field, headline, waitlist form, and the
// app-shot card sitting on the horizon line (Portal's screenshot-over-landscape move).
// The card's negative bottom margin makes it overlap the paper section below;
// Landing.tsx gives the next section matching top padding.
export default function Hero() {
  return (
    <section className="dusk-sky relative overflow-visible pb-0 pt-28 sm:pt-36">
      {/* Star field behind the copy */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <Constellation fill labels={false} className="h-full w-full" />
      </div>

      {/* Scrim: keeps the headline zone readable over the star field */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 50% at 50% 35%, rgba(8,6,28,0.65) 0%, rgba(8,6,28,0) 70%)" }}
      />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="hero-in font-mono rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-star/80 backdrop-blur" style={{ "--hero-delay": "0ms" } as React.CSSProperties}>
          Closed beta — limited seats
        </span>
        <h1
          className="hero-in font-display mt-6 text-balance text-[clamp(2.6rem,7vw,4.75rem)] font-extrabold leading-[1.02] tracking-[-0.02em] text-star"
          style={{ "--hero-delay": "120ms" } as React.CSSProperties}
        >
          Meet the AI that remembers you. Watch your world become a map.
        </h1>
        <p
          className="hero-in font-body mt-6 max-w-xl text-pretty text-lg leading-relaxed text-star/75"
          style={{ "--hero-delay": "240ms" } as React.CSSProperties}
        >
          Hype learns who you are through real conversation — and turns it into a
          living, glowing graph of everything that makes you <em>you</em>. Yours to
          see, edit, and take anywhere.
        </p>
        <div className="hero-in mt-8 flex w-full justify-center" style={{ "--hero-delay": "360ms" } as React.CSSProperties}>
          <WaitlistForm />
        </div>
        <p className="hero-in font-body mt-3 text-xs text-star/50" style={{ "--hero-delay": "420ms" } as React.CSSProperties}>
          Free in beta · No card, ever
        </p>
      </div>

      {/* App-shot card on the horizon — swap inner content for /app-shot.png when captured. */}
      <div className="relative z-10 mx-auto -mb-24 mt-16 w-[min(92%,56rem)] sm:-mb-32">
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0d0d0d] shadow-[0_40px_120px_-24px_rgba(8,6,28,0.8)]">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            <span className="font-mono ml-3 text-[10px] uppercase tracking-widest text-white/30">Hype — your graph</span>
          </div>
          <div className="relative aspect-[16/9]">
            <Constellation fill className="h-full w-full" />
            <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 backdrop-blur">
              <span className="font-body flex-1 text-left text-sm text-white/40">Tell me about your week…</span>
              <span className="font-body rounded-full bg-white/90 px-4 py-1 text-xs font-semibold text-black shadow-[0_0_16px_-2px_rgba(255,255,255,0.55)]">Send</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

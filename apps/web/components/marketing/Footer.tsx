import Constellation from "./Constellation"
import WaitlistForm from "./WaitlistForm"
import Reveal from "./Reveal"

// Block 11 — the night returns: closing CTA over the constellation, then footer links.
export default function Footer() {
  return (
    <footer className="night-sky relative overflow-hidden">
      <span id="join" className="absolute top-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] opacity-40">
        <Constellation fill labels={false} className="h-full w-full" />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 55% 45% at 50% 40%, rgba(11,9,32,0.6) 0%, rgba(11,9,32,0) 70%)" }}
      />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pb-40 pt-24 text-center sm:pt-32">
        <Reveal className="flex flex-col items-center">
          <h2 className="font-display text-balance text-[clamp(2.2rem,6vw,3.75rem)] font-extrabold leading-[1.03] tracking-[-0.02em] text-star">
            Be one of the first.
          </h2>
          <p className="font-body mt-5 max-w-md text-pretty leading-relaxed text-star/70">
            Hype is opening to a small group of beta testers. Leave your email and
            I&apos;ll personally send you an invite.
          </p>
          <div className="mt-8 flex w-full justify-center">
            <WaitlistForm />
          </div>
        </Reveal>
      </div>
      <div className="relative border-t border-white/10">
        <div className="font-body mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-star/50">
          <span>© 2026 Hype</span>
          <a href="mailto:mendella.joshua@gmail.com" className="transition-colors hover:text-star">Contact</a>
        </div>
      </div>
    </footer>
  )
}

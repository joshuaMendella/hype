import SiteNav from "./SiteNav"
import Hero from "./Hero"
import Statement from "./Statement"
import IconGrid from "./IconGrid"
import DeepDives from "./DeepDives"
import OwnershipGrid from "./OwnershipGrid"
import PaletteShowcase from "./PaletteShowcase"
import Steps from "./Steps"
import TheCatch from "./TheCatch"
import FounderMemo from "./FounderMemo"
import Footer from "./Footer"

// Portal-style landing — 11 blocks, dusk→day→night.
// Spec: docs/superpowers/specs/2026-07-13-landing-portal-style-design.md
export default function Landing() {
  return (
    <div className="landing bg-paper">
      <SiteNav />
      <Hero />

      {/* pt compensates the hero app-card's negative bottom margin */}
      <section className="pt-44 sm:pt-56">
        <Statement kicker="Why Hype exists" color="#7c3aed" title="You've told a hundred apps who you are. Not one of them was listening.">
          <p>
            Your music app knows your playlists. Your maps app knows your commute.
            Your shopping app knows your size. Each one holds a sliver of you, none of
            them talk to each other — and not one could tell you your best friend&apos;s
            birthday.
          </p>
          <p>
            Hype starts from the opposite end: one genuine conversation at a time, it
            learns your world the way a friend would — and keeps it in a graph you can
            actually see. Not for our benefit. For yours.
          </p>
        </Statement>
      </section>

      <section className="pt-20 sm:pt-24">
        <IconGrid />
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement id="how-it-works" kicker="What you get" color="#0f766e" title="A memory you can watch being made.">
          <p>Four things happen when you talk to Hype. Here&apos;s each one, up close.</p>
        </Statement>
        <div className="pt-16 sm:pt-24">
          <DeepDives />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="Your data, actually yours" color="#15803d" title="Stop being the product.">
          <p>Every app profiles you in the dark. Hype does the opposite — the profile is the product, and it belongs to you.</p>
        </Statement>
        <div className="pt-12 sm:pt-16">
          <OwnershipGrid />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="Make it yours" color="#db2777" title="A graph that looks like you.">
          <p>
            Four palettes, your colors, your constellation. Share a snapshot of your
            world with one tap — it&apos;s the prettiest thing your camera roll has seen
            all week.
          </p>
        </Statement>
        <div className="pt-12 sm:pt-16">
          <PaletteShowcase />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement kicker="From hello to home screen" color="#2563eb" title="Here's how it goes." />
        <div className="pt-12 sm:pt-16">
          <Steps />
        </div>
      </section>

      <section className="pt-28 sm:pt-36">
        <Statement id="the-deal" kicker="The deal" color="#d97706" title="What's the catch? Glad you asked." />
        <div className="pt-12 sm:pt-16">
          <TheCatch />
        </div>
      </section>

      <section className="pb-28 pt-28 sm:pb-36 sm:pt-36">
        <FounderMemo />
      </section>

      <Footer />
    </div>
  )
}

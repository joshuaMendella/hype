// apps/web/lib/onboarding/script.ts
// Fixed onboarding copy (Fable draft, 2026-07-12). Beats 1–6 are deterministic and
// app-rendered — do not route these through an LLM. Beat 7 is the live interviewer.
export const onboardingCopy = {
  welcome: (name: string) => `Hey ${name}. Good to have you here.`,
  howto:
    "There's nothing to set up. We just talk — a little each day, whatever's on your mind — and I remember.",
  consentIntro:
    "One thing before we start: as I get to know you, I'll sometimes spot something hyper-tailored to you. I'll only ever bring it up if you say yes — like this:",
  exampleAsk:
    "Hey — those running shoes you'd been eyeing just dropped in price. Want me to pull it up?",
  askLocation: "Okay — easy one first. Where do you call home these days?",
  askWork: "And what fills your days — do you study, work, a bit of both?",
  confirm:
    "Look at your graph — those just appeared, and they're linked to you. That canvas is yours now, and it grows every time we talk.",
} as const

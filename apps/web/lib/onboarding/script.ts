// apps/web/lib/onboarding/script.ts
// Fixed onboarding copy (Fable locked draft, 2026-07-12). Beats 1–6 are deterministic and
// app-rendered — never routed through an LLM. Beat 7 is the live interviewer. Owner will
// refine wording later; keep this a single swappable source of truth.
export const onboardingCopy = {
  welcome: (name: string) => `Hey ${name}. Go on — say hi back. That's genuinely the whole tutorial.`,
  howto:
    "See that lone dot behind this chat? That's you, day one. Everything you tell me becomes part of that map — quietly, while we just talk. But first, the honest bit about how this works.",
  consentIntro:
    "Here's the deal up front: Hype's free, and it stays free because once I really know you, I'll occasionally spot something hyper-tailored — a price drop, a show near you, a thing you actually wanted. I never just show it. I ask first, like this:",
  consentTrailing:
    "You say yes or no, every single time. No toggle buried in settings — just me, asking. Fair deal?",
  exampleAsk:
    "Hey — those running shoes you'd been eyeing just dropped in price. Want me to pull it up?",
  askLocation: "Good. Now the easy stuff — what city is home right now?",
  askWork: (city: string) =>
    `${city} — there it is, your first pin. Next: what does your week mostly go to? A job, a degree, something of your own — name it the way you'd tell a friend.`,
  workRetry: "Ha — fair. What's the biggest slice, though?",
  confirm:
    "Look at the graph — those two just grew out of what you said, and they're linked to you. That's the whole loop: you talk, it grows. And it's yours — readable, exportable, deletable, down to every note. Spot them?",
} as const

// Input placeholder per beat — mirrors the expected reply so the user knows to type
// (solves "do I type here?" without an instruction). Keyed by ObStep.
export const onboardingPlaceholder: Record<string, string> = {
  welcome: "say hi",
  howto: "go on",
  consent: "fair enough?",
  location: "your city",
  work: "what you do",
  confirm: "…",
}

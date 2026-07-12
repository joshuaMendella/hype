// apps/web/lib/onboarding/titles.ts
// Pure title/type heuristics for onboarding node seeding. NO imports — safe from both
// browser and server. The /api/onboarding/seed route imports these as the fallback when
// the structured LLM classify call fails. (Extracted from the old seed.ts.)

export const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Strip conversational lead-ins from a location answer so the node title is the place itself.
export function stripLeadIn(s: string): string {
  return s
    .trim()
    .replace(
      /^(i (currently )?(live|stay|am|'m) (in|at|from)|i'?m (in|from)|home is|based in|it'?s|currently)\s+/i,
      "",
    )
    .trim()
}

// Fallback title for the work/study node (LLM classify is the primary path).
export function workNodeTitle(answer: string): string {
  const a = answer.trim()
  if (/stud|school|uni|college|degree/i.test(a)) return "School"
  if (/^(work|working|a job|job|both|a bit of both|yes|yeah|kinda)\b/i.test(a) || a.length < 3)
    return "Work"
  return a.slice(0, 60)
}

// A category-shaped / non-committal work answer that would yield a weak node — triggers the
// one-shot in-voice retry ("what's the biggest slice?") before anything is seeded.
export function isVagueWork(answer: string): boolean {
  const a = answer.trim().toLowerCase()
  if (a.length < 3) return true
  return /^(work|working|a job|job|both|a bit of both|a bit of everything|everything|stuff|things|yes|yeah|kinda|idk|not sure|dunno|this and that)\b\.?$/.test(a)
}

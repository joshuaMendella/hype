// apps/web/lib/onboarding/seed.ts
import { createClient } from "@/lib/supabase/client"

// Same slug rule as lib/ai/extract.ts so seeded paths match extraction-created ones.
export const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Strip common conversational lead-ins from a location answer so the node title is the
// place itself. ponytail: modest regex; a weird answer still yields a usable-enough node,
// which later extraction/Gardener can refine.
export function stripLeadIn(s: string): string {
  return s
    .trim()
    .replace(
      /^(i (currently )?(live|stay|am|'m) (in|at|from)|i'?m (in|from)|home is|based in|it'?s|currently)\s+/i,
      "",
    )
    .trim()
}

// Title for the work/study node from a freeform answer.
// ponytail: 3-branch heuristic. Ceiling: a vague answer ("a bit of both") yields the
// generic "Work"; when the user later names an employer, extraction adds/updates a node
// and the Gardener can merge. Onboarding just needs a second node to visibly appear.
export function workNodeTitle(answer: string): string {
  const a = answer.trim()
  if (/stud|school|uni|college|degree/i.test(a)) return "School"
  if (/^(work|working|a job|job|both|a bit of both|yes|yeah|kinda)\b/i.test(a) || a.length < 3)
    return "Work"
  return a.slice(0, 60)
}

const NOTE_SELECT = "id, title, topic, path, content_md, intent, source, entity_type"

export async function seedLocationNode(userId: string, rawAnswer: string): Promise<string> {
  const supabase = createClient()
  const city = stripLeadIn(rawAnswer).slice(0, 60) || rawAnswer.trim().slice(0, 60)
  await supabase.from("vault_notes").upsert(
    {
      user_id: userId,
      path: `place/${toSlug(city)}.md`,
      title: city,
      topic: "place",
      entity_type: "place",
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )
  // Merge home_location without clobbering other base_profile keys (mirrors lib/ai/extract.ts).
  const { data: prof } = await supabase
    .from("profiles")
    .select("base_profile")
    .eq("id", userId)
    .single()
  const base = { ...((prof?.base_profile as Record<string, unknown>) ?? {}), home_location: city }
  await supabase.from("profiles").update({ base_profile: base }).eq("id", userId)
  return city
}

export async function seedWorkNode(userId: string, rawAnswer: string): Promise<void> {
  const supabase = createClient()
  const title = workNodeTitle(rawAnswer)
  await supabase.from("vault_notes").upsert(
    {
      user_id: userId,
      path: `org/${toSlug(title)}.md`,
      title,
      topic: "work",
      entity_type: "org",
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("profiles").update({ onboarded: true }).eq("id", userId)
}

// Silence unused-select lint if a reader expects it; NOTE_SELECT documents the shape the
// graph reads back on refresh (see components/graph/GraphCanvas.tsx fetch).
void NOTE_SELECT

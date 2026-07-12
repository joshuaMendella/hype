// apps/web/app/api/onboarding/seed/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { classifySeed, type SeedKind } from "@/lib/onboarding/classify"
import { toSlug, isVagueWork } from "@/lib/onboarding/titles"

// Seeds one onboarding graph node (home city or occupation) from a freeform answer.
// Auth comes from the cookie session — userId is NEVER trusted from the body; writes are
// RLS-scoped to that user. Returns the clean node title + a lowConfidence flag the client
// uses to fire a single in-voice retry before committing a weak work node.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind: SeedKind = body.kind === "work" ? "work" : "location"
  const answer = typeof body.answer === "string" ? body.answer.trim() : ""
  const force = body.force === true
  if (!answer) return NextResponse.json({ error: "empty_answer" }, { status: 400 })

  const c = await classifySeed(kind, answer)
  const lowConfidence = kind === "work" && (c.confidence < 0.5 || isVagueWork(answer))

  // Weak work answer, first pass → don't write yet; the client asks one clarifying question
  // and re-posts with force. Location never retries.
  if (lowConfidence && !force) {
    return NextResponse.json({ title: c.title, entity_type: c.entity_type, lowConfidence: true })
  }

  const dir = c.entity_type // "place" | "org" | "interest" — folder mirrors entity type
  const topic = kind === "location" ? "place" : "work"
  await supabase.from("vault_notes").upsert(
    {
      user_id: user.id,
      path: `${dir}/${toSlug(c.title)}.md`,
      title: c.title,
      topic,
      entity_type: c.entity_type,
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )

  if (kind === "location") {
    const { data: prof } = await supabase.from("profiles").select("base_profile").eq("id", user.id).single()
    const base = { ...((prof?.base_profile as Record<string, unknown>) ?? {}), home_location: c.title }
    await supabase.from("profiles").update({ base_profile: base }).eq("id", user.id)
  }

  return NextResponse.json({ title: c.title, entity_type: c.entity_type, lowConfidence: false })
}

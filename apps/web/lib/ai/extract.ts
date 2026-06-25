import Groq from "groq-sdk"
import { createAdminClient } from "@/lib/supabase/admin"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type Message = { role: string; content: string }
type Fact = { title: string; topic: string; content_md: string }

function buildPrompt(existingTitles: string[]) {
  const known = existingTitles.length
    ? `\n\nAlready captured (do NOT recreate these — only extract NEW, more specific facts not yet in this list):\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : ""
  return `You extract atomic facts about a person from conversation excerpts.

Return JSON exactly: {"facts": [{"title": "3-6 word specific title", "topic": "one of: Profile|Work|Style|Food|Fitness|People|Goals|Insights", "content_md": "one sentence fact"}]}

Rules:
- Each fact must be atomic — one specific detail per node (e.g. "Prefers Loafers" is separate from "Shopping for Shoes")
- Only extract what the person explicitly stated
- Skip greetings, questions, filler, and vague answers
- Titles must be specific: "Prefers Loafers" not "Shoe Preference", "Drinks Oat Milk Lattes" not "Coffee Habits"
- If the person adds detail to something already known, extract ONLY the new specific detail as its own fact
- Return {"facts": []} if nothing new or concrete was shared${known}`
}

export async function extractFacts(
  conversationId: string,
  messages: Message[],
  userId: string
) {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from("vault_notes")
    .select("title")
    .eq("user_id", userId)
    .eq("source", "conversation")

  const existingTitles = (existing ?? []).map((n) => n.title)

  const transcript = messages
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  let facts: Fact[] = []
  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt(existingTitles) },
        { role: "user", content: transcript },
      ],
    })
    facts = JSON.parse(res.choices[0]?.message?.content ?? "{}").facts ?? []
  } catch (err) {
    console.error("[extract] Groq call failed:", err)
    return
  }

  if (!facts.length) return

  // Get the root "You" node — every topic hub links from here
  const { data: rootNote, error: rootErr } = await supabase
    .from("vault_notes")
    .select("id")
    .eq("user_id", userId)
    .eq("path", "_profile.md")
    .single()

  if (rootErr || !rootNote) {
    console.error("[extract] Root note not found:", rootErr)
    return
  }

  for (const fact of facts) {
    const slug = fact.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const factPath = `${fact.topic.toLowerCase()}/${slug}.md`
    const topicPath = `${fact.topic.toLowerCase()}/index.md`

    // Upsert fact note
    const { data: factNote, error: factErr } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: factPath, title: fact.title, topic: fact.topic, content_md: fact.content_md, source: "conversation", confidence: 0.8 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()

    if (factErr || !factNote) {
      console.error("[extract] fact upsert failed:", factErr)
      continue
    }

    // Upsert topic hub node (e.g. "Food", "Work")
    const { data: topicHub, error: topicErr } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: topicPath, title: fact.topic, topic: fact.topic, content_md: "", source: "system", confidence: 1 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()

    if (topicErr || !topicHub) {
      console.error("[extract] topic hub upsert failed:", topicErr)
      continue
    }

    // Link: You → Topic hub
    const { error: l1Err } = await supabase
      .from("vault_links")
      .upsert(
        { user_id: userId, source_note_id: rootNote.id, target_note_id: topicHub.id },
        { onConflict: "source_note_id,target_note_id" }
      )
    if (l1Err) console.error("[extract] You→Topic link failed:", l1Err)

    // Link: Topic hub → Fact
    const { error: l2Err } = await supabase
      .from("vault_links")
      .upsert(
        { user_id: userId, source_note_id: topicHub.id, target_note_id: factNote.id },
        { onConflict: "source_note_id,target_note_id" }
      )
    if (l2Err) console.error("[extract] Topic→Fact link failed:", l2Err)

    // Audit trail
    const { error: extErr } = await supabase
      .from("extractions")
      .insert({ conversation_id: conversationId, note_id: factNote.id })
    if (extErr) console.error("[extract] extractions insert failed:", extErr)
  }
}

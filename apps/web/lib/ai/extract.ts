import Groq from "groq-sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { TOPICS } from "./topics"
import { TOPIC_CATEGORIES } from "./categories"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type Message = { role: string; content: string }
type Attribute = { title: string; content_md: string }
type Fact = { title: string; topic: string; category: string; content_md: string; intent: boolean; scheduled_for: string | null; brand: string | null; attributes: Attribute[] }

function buildPrompt(existingTitles: string[], today: string) {
  const known = existingTitles.length
    ? `\n\nAlready captured (do NOT recreate these — only extract NEW, more specific facts not yet in this list):\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : ""

  const categoryLines = Object.entries(TOPIC_CATEGORIES)
    .map(([topic, cats]) => `  ${topic}: ${cats.join(" | ")}`)
    .join("\n")

  return `You extract atomic facts about a person from conversation excerpts.
Today's date: ${today}

Return JSON exactly: {"facts": [{"title": "3-6 word specific title", "topic": "one of: ${TOPICS.join("|")}", "category": "see list below", "content_md": "one sentence fact", "intent": false, "scheduled_for": null, "brand": null, "attributes": []}]}

category: MUST be exactly one from the topic's list below — never invent a new category name.
${categoryLines}

brand: when a fact involves a specific named brand or company (a purchase, an owned item, a brand preference), set to the exact brand name (e.g. "The Ordinary", "Zara", "Apple"). Null otherwise.

Set intent: true when the person expresses desire or active consideration to buy, get, or do something.

scheduled_for: set to an ISO date string (YYYY-MM-DD) when the fact involves something happening on a specific future date — a meeting, trip, appointment, event, dinner, concert, etc. Resolve relative dates ("tomorrow", "Friday", "next week") using today's date above. Set null if no specific date is mentioned.

attributes: for concrete facts, list known properties as {"title": "Property", "content_md": "value"}. The brand goes in the brand field, not here. Examples:
- Purchase → Color: Blue, Size: M, Price: €29 (price ONLY if explicitly stated)
- Place → Area: Soho, With: Partner
- Event → Venue: Madison Square Garden, With: Friends
Leave attributes as [] for simple preferences or habits.

Rules:
- Each fact must be atomic — one specific detail per node
- Only extract what the person explicitly stated
- Skip greetings, questions, filler, and vague answers
- Titles must be specific: "Prefers Loafers" not "Shoe Preference"
- Return {"facts": []} if nothing new or concrete was shared

Durability rule — only extract facts that reveal something lasting about who this person is. Valid categories:
1. Ownership: something they have ("Owns Brown Polo Shirt from Zara")
2. Preference: something they like or habitually choose ("Prefers Iced Americano", "Shops at Zara")
3. Intent: something they want or plan to get/do ("Wants Semi-Formal Grey Trousers")
4. Routine: something they do regularly ("Goes to Starbucks 3-4x Per Week")

One-time activities are NOT facts — skip "went shopping", "had a coffee", "watched a movie", "worked all day", and any similar event unless it produced an ownership, preference, intent, or routine fact. The activity is context, not the fact itself.

No inference rule — never derive a fact from implication. Only extract what the person explicitly stated. Examples of forbidden inference:
- "worked half day" → do NOT extract anything about employment type. Half day ≠ part-time.
- "went out shopping" → do NOT extract "shops regularly". One trip ≠ a habit.
- "had a coffee" → do NOT extract "drinks coffee daily". One mention ≠ a routine.
If the information needed to make a fact true was not explicitly stated, skip it entirely.

No pattern from a single instance — routine and habit facts require the user to explicitly state frequency or regularity ("every day", "3-4 times a week", "I always", "usually"). A single mention of an activity is never evidence of a pattern.${known}`
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

  const today = new Date().toISOString().split("T")[0]
  const transcript = messages
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")

  let facts: Fact[] = []
  try {
    const res = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt(existingTitles, today) },
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
    const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    const topicDir = toSlug(fact.topic)
    const catSlug = toSlug(fact.category)
    const factSlug = toSlug(fact.title)
    const topicPath = `${topicDir}/index.md`
    const catPath = `${topicDir}/${catSlug}/index.md`
    const factPath = `${topicDir}/${catSlug}/${factSlug}.md`

    // Upsert topic hub (layer 2)
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

    // Upsert category hub (layer 3)
    const { data: catHub, error: catErr } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: catPath, title: fact.category, topic: fact.topic, content_md: "", source: "system", confidence: 1 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()

    if (catErr || !catHub) {
      console.error("[extract] category hub upsert failed:", catErr)
      continue
    }

    // Serialize attributes into fact content_md (not graph nodes)
    const attrLines = (fact.attributes ?? []).map((a) => `- **${a.title}**: ${a.content_md}`)
    const fullContent = attrLines.length ? `${fact.content_md}\n\n${attrLines.join("\n")}` : fact.content_md

    // Upsert fact note (layer 4)
    const { data: factNote, error: factErr } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: factPath, title: fact.title, topic: fact.topic, content_md: fullContent, intent: fact.intent ?? false, scheduled_for: fact.scheduled_for ?? null, source: "conversation", confidence: 0.8 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()

    if (factErr || !factNote) {
      console.error("[extract] fact upsert failed:", factErr)
      continue
    }

    // Links: You → Topic → Category → Fact
    await supabase.from("vault_links").upsert(
      { user_id: userId, source_note_id: rootNote.id, target_note_id: topicHub.id },
      { onConflict: "source_note_id,target_note_id" }
    )
    await supabase.from("vault_links").upsert(
      { user_id: userId, source_note_id: topicHub.id, target_note_id: catHub.id },
      { onConflict: "source_note_id,target_note_id" }
    )
    await supabase.from("vault_links").upsert(
      { user_id: userId, source_note_id: catHub.id, target_note_id: factNote.id },
      { onConflict: "source_note_id,target_note_id" }
    )

    // Brand node + cross-link (fact → brand, separate from category tree)
    if (fact.brand) {
      const brandSlug = toSlug(fact.brand)
      const brandsCatPath = `${topicDir}/brands/index.md`
      const brandPath = `${topicDir}/brands/${brandSlug}.md`

      const { data: brandsCatHub } = await supabase
        .from("vault_notes")
        .upsert(
          { user_id: userId, path: brandsCatPath, title: "Brands", topic: fact.topic, content_md: "", source: "system", confidence: 1 },
          { onConflict: "user_id,path" }
        )
        .select("id")
        .single()

      const { data: brandNote } = await supabase
        .from("vault_notes")
        .upsert(
          { user_id: userId, path: brandPath, title: fact.brand, topic: fact.topic, content_md: "", source: "system", confidence: 1 },
          { onConflict: "user_id,path" }
        )
        .select("id")
        .single()

      if (brandsCatHub && brandNote) {
        await supabase.from("vault_links").upsert(
          { user_id: userId, source_note_id: topicHub.id, target_note_id: brandsCatHub.id },
          { onConflict: "source_note_id,target_note_id" }
        )
        await supabase.from("vault_links").upsert(
          { user_id: userId, source_note_id: brandsCatHub.id, target_note_id: brandNote.id },
          { onConflict: "source_note_id,target_note_id" }
        )
        // Cross-link: fact → brand (specific to general, avoids cycle in main tree)
        await supabase.from("vault_links").upsert(
          { user_id: userId, source_note_id: factNote.id, target_note_id: brandNote.id },
          { onConflict: "source_note_id,target_note_id" }
        )
      }
    }

    await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: factNote.id })
  }
}

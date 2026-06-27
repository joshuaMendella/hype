import Groq from "groq-sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { TOPICS } from "./topics"
import { getMissingAttrs, type Agenda, type AgendaItem } from "./checklists"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

type Message = { role: string; content: string }
type Attribute = { title: string; value: string }
type Entity = {
  title: string
  topic: string
  brand: string | null
  entity_type: "item" | "brand" | "place" | "event" | "person"
  content_md: string
  attributes: Attribute[]
  intent: boolean
  scheduled_for: string | null
}

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function buildPrompt(existingTitles: string[], today: string) {
  const known = existingTitles.length
    ? `\n\nAlready captured — do NOT recreate these:\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
    : ""

  return `You extract ENTITIES from conversations about a person's life.
An entity is a specific real-world thing: a purchase, a brand they use, a place they visit, an event, or a person in their life.
Today's date: ${today}

Return JSON exactly:
{"entities": [{"title": "...", "topic": "...", "brand": null, "entity_type": "item", "content_md": "...", "attributes": [], "intent": false, "scheduled_for": null}]}

Fields:
- title: the THING itself, not a statement about it
- topic: one of: ${TOPICS.join(" | ")}
- brand: exact brand/company name if named, null otherwise
- entity_type: "item" | "brand" | "place" | "event" | "person"
- content_md: one sentence describing this entity
- attributes: concrete known properties as [{"title": "Color", "value": "Blue"}]
- intent: true if the person wants/plans to get this but doesn't have it yet
- scheduled_for: ISO date (YYYY-MM-DD) for dated events/trips, null otherwise

entity_type guide:
- "item": a specific product (shirt, belt, phone, coffee order)
- "brand": a brand or store when no specific item is known ("Shops at Zara")
- "place": a location they go to (restaurant, mall, gym, park)
- "event": a happening (trip, concert, appointment)
- "person": someone in their life (partner, friend, family member)

title must name THE THING, not describe their relationship to it:
✓ "Blue Belt"         not "Exchanged Belt at Zara"
✓ "Zara" (brand)      not "Shops at Zara"
✓ "Westfield Mall" (place) not "Goes to Westfield Mall"
✓ "Paris Trip"        not "Traveled to Paris"

When entity_type is "brand", set brand = title.

attributes — only what was explicitly stated:
- Clothing/accessory → Color, Size, Material, Price (only if stated)
- Tech → Model, Price (only if stated)
- Place → Cuisine, Location, Frequency, With
- Event → Date, Location, With
- Person → Relationship, Context

Places and people mentioned even in passing are worth extracting — they become pending threads for the interviewer to follow up on. A mall visited, a restaurant mentioned, a friend referenced: extract them even with no attributes yet.

Durability — extract entities that reveal something about this person's life: owned items, preferred brands, frequent places, relationships, plans. Skip pure one-off filler ("had a coffee") unless it yields a concrete entity.

No inference — only extract what was explicitly stated.
No pattern from a single instance — "visits often" or "goes regularly" requires the user to have stated frequency.${known}`
}

async function updateConversationAgenda(
  supabase: ReturnType<typeof createAdminClient>,
  conversationId: string
) {
  const { data: rows } = await supabase
    .from("extractions")
    .select("vault_notes(title, topic, path, content_md, source)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })

  const seen = new Set<string>()
  const incomplete: AgendaItem[] = []

  for (const row of rows ?? []) {
    const note = (row as any).vault_notes
    if (!note || note.source !== "conversation" || seen.has(note.path)) continue
    seen.add(note.path)
    const missing = getMissingAttrs(note.topic, note.content_md ?? "")
    if (missing.length > 0) {
      incomplete.push({ title: note.title, topic: note.topic, path: note.path, missing })
    }
  }

  const agenda: Agenda = {
    current: incomplete[0] ?? null,
    pending: incomplete.slice(1),
  }

  await supabase.from("conversations").update({ agenda }).eq("id", conversationId)
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

  let entities: Entity[] = []
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
    entities = JSON.parse(res.choices[0]?.message?.content ?? "{}").entities ?? []
  } catch (err) {
    console.error("[extract] Groq call failed:", err)
    return
  }

  if (!entities.length) {
    await updateConversationAgenda(supabase, conversationId)
    return
  }

  for (const entity of entities) {
    const topicDir = toSlug(entity.topic)
    const topicPath = `${topicDir}/index.md`

    // Topic hub
    const { data: topicHub, error: topicErr } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: topicPath, title: entity.topic, topic: entity.topic, content_md: "", source: "system", confidence: 1 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()

    if (topicErr || !topicHub) {
      console.error("[extract] topic hub upsert failed:", topicErr)
      continue
    }

    const attrLines = (entity.attributes ?? []).map((a) => `- **${a.title}**: ${a.value}`)
    const fullContent = attrLines.length
      ? `${entity.content_md}\n\n${attrLines.join("\n")}`
      : entity.content_md

    if (entity.brand) {
      const brandSlug = toSlug(entity.brand)
      const brandPath = `${topicDir}/${brandSlug}.md`

      if (entity.entity_type === "brand") {
        // Brand-level preference: accumulate into brand node content
        const { data: existingBrand } = await supabase
          .from("vault_notes")
          .select("id, content_md")
          .eq("user_id", userId)
          .eq("path", brandPath)
          .maybeSingle()

        if (existingBrand) {
          if (!existingBrand.content_md?.includes(entity.content_md)) {
            const updated = existingBrand.content_md
              ? `${existingBrand.content_md}\n- ${entity.content_md}`
              : `- ${entity.content_md}`
            await supabase.from("vault_notes").update({ content_md: updated }).eq("id", existingBrand.id)
          }
          await supabase.from("vault_links").upsert(
            { user_id: userId, source_note_id: topicHub.id, target_note_id: existingBrand.id },
            { onConflict: "source_note_id,target_note_id" }
          )
        } else {
          const { data: brandNote } = await supabase
            .from("vault_notes")
            .insert({
              user_id: userId, path: brandPath, title: entity.brand, topic: entity.topic,
              content_md: `- ${entity.content_md}`, source: "system", confidence: 1,
            })
            .select("id")
            .single()

          if (brandNote) {
            await supabase.from("vault_links").upsert(
              { user_id: userId, source_note_id: topicHub.id, target_note_id: brandNote.id },
              { onConflict: "source_note_id,target_note_id" }
            )
            await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: brandNote.id })
          }
        }
      } else {
        // Specific item under a brand: Topic → Brand → Item
        const entitySlug = toSlug(entity.title)
        const entityPath = `${topicDir}/${brandSlug}/${entitySlug}.md`

        const { data: brandHub } = await supabase
          .from("vault_notes")
          .upsert(
            { user_id: userId, path: brandPath, title: entity.brand, topic: entity.topic, content_md: "", source: "system", confidence: 1 },
            { onConflict: "user_id,path" }
          )
          .select("id")
          .single()

        if (!brandHub) continue

        await supabase.from("vault_links").upsert(
          { user_id: userId, source_note_id: topicHub.id, target_note_id: brandHub.id },
          { onConflict: "source_note_id,target_note_id" }
        )

        const { data: entityNote } = await supabase
          .from("vault_notes")
          .upsert(
            {
              user_id: userId, path: entityPath, title: entity.title, topic: entity.topic,
              content_md: fullContent, intent: entity.intent ?? false,
              scheduled_for: entity.scheduled_for ?? null, source: "conversation", confidence: 0.8,
            },
            { onConflict: "user_id,path" }
          )
          .select("id")
          .single()

        if (!entityNote) continue

        await supabase.from("vault_links").upsert(
          { user_id: userId, source_note_id: brandHub.id, target_note_id: entityNote.id },
          { onConflict: "source_note_id,target_note_id" }
        )
        await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
      }
    } else {
      // No brand: Topic → Entity directly
      const entitySlug = toSlug(entity.title)
      const entityPath = `${topicDir}/${entitySlug}.md`

      const { data: entityNote } = await supabase
        .from("vault_notes")
        .upsert(
          {
            user_id: userId, path: entityPath, title: entity.title, topic: entity.topic,
            content_md: fullContent, intent: entity.intent ?? false,
            scheduled_for: entity.scheduled_for ?? null, source: "conversation", confidence: 0.8,
          },
          { onConflict: "user_id,path" }
        )
        .select("id")
        .single()

      if (!entityNote) continue

      await supabase.from("vault_links").upsert(
        { user_id: userId, source_note_id: topicHub.id, target_note_id: entityNote.id },
        { onConflict: "source_note_id,target_note_id" }
      )
      await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
    }
  }

  // Update agenda after all entities are processed
  await updateConversationAgenda(supabase, conversationId)
}

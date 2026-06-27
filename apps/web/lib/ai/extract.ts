import { createAdminClient } from "@/lib/supabase/admin"
import { getMissingAttrs, type Agenda, type AgendaItem } from "./checklists"

export type Attr = { title: string; value: string }
export type RawEntity = {
  title: string
  topic: string
  brand: string | null
  entity_type: "item" | "brand" | "place" | "event" | "person"
  intent: boolean
  scheduled_for: string | null
  description: string
  attributes?: Attr[]
}
export type ExtractionResult = { attributes: Attr[]; entities: RawEntity[] }

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// ponytail: flush after this many turns if entity still incomplete — avoids needing an explicit abandon signal
const ABANDON_AFTER_TURNS = 5

function attrsToContentMd(attrs: Attr[]): string {
  return attrs.map((a) => `- **${a.title}**: ${a.value}`).join("\n")
}

function makeAgendaItem(entity: RawEntity): AgendaItem {
  const seedAttrs = entity.attributes ?? []
  return {
    title: entity.title,
    topic: entity.topic,
    brand: entity.brand ?? null,
    entity_type: entity.entity_type,
    intent: entity.intent ?? false,
    scheduled_for: entity.scheduled_for ?? null,
    description: entity.description ?? "",
    missing: getMissingAttrs(entity.topic, seedAttrs.map(a => `- **${a.title}**: ${a.value}`).join("\n")),
    attributes: seedAttrs,
    turns: 0,
  }
}

async function writeEntityToVault(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  conversationId: string,
  item: AgendaItem
) {
  const topicDir = toSlug(item.topic)

  const { data: topicHub } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: `${topicDir}/index.md`, title: item.topic, topic: item.topic, content_md: "", source: "system", confidence: 1 },
      { onConflict: "user_id,path" }
    )
    .select("id")
    .single()

  if (!topicHub) return

  const attrLines = item.attributes.map((a) => `- **${a.title}**: ${a.value}`)
  const fullContent = [item.description, attrLines.join("\n")].filter(Boolean).join("\n\n")

  if (!item.brand) {
    const entityPath = `${topicDir}/${toSlug(item.title)}.md`
    const { data: entityNote } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: entityPath, title: item.title, topic: item.topic, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()
    if (!entityNote) return
    await supabase.from("vault_links").upsert({ user_id: userId, source_note_id: topicHub.id, target_note_id: entityNote.id }, { onConflict: "source_note_id,target_note_id" })
    await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
    return
  }

  const brandPath = `${topicDir}/${toSlug(item.brand)}.md`

  if (item.entity_type === "brand") {
    const { data: existing } = await supabase.from("vault_notes").select("id, content_md").eq("user_id", userId).eq("path", brandPath).maybeSingle()
    if (existing) {
      if (!existing.content_md?.includes(item.description)) {
        const updated = existing.content_md ? `${existing.content_md}\n- ${item.description}` : `- ${item.description}`
        await supabase.from("vault_notes").update({ content_md: updated }).eq("id", existing.id)
      }
      await supabase.from("vault_links").upsert({ user_id: userId, source_note_id: topicHub.id, target_note_id: existing.id }, { onConflict: "source_note_id,target_note_id" })
    } else {
      const { data: brandNote } = await supabase
        .from("vault_notes")
        .insert({ user_id: userId, path: brandPath, title: item.brand, topic: item.topic, content_md: `- ${item.description}`, source: "system", confidence: 1 })
        .select("id")
        .single()
      if (!brandNote) return
      await supabase.from("vault_links").upsert({ user_id: userId, source_note_id: topicHub.id, target_note_id: brandNote.id }, { onConflict: "source_note_id,target_note_id" })
      await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: brandNote.id })
    }
    return
  }

  // Topic → Brand → Item
  const { data: brandHub } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: brandPath, title: item.brand, topic: item.topic, content_md: "", source: "system", confidence: 1 },
      { onConflict: "user_id,path" }
    )
    .select("id")
    .single()
  if (!brandHub) return

  await supabase.from("vault_links").upsert({ user_id: userId, source_note_id: topicHub.id, target_note_id: brandHub.id }, { onConflict: "source_note_id,target_note_id" })

  const entityPath = `${topicDir}/${toSlug(item.brand)}/${toSlug(item.title)}.md`
  const { data: entityNote } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: entityPath, title: item.title, topic: item.topic, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
      { onConflict: "user_id,path" }
    )
    .select("id")
    .single()
  if (!entityNote) return

  await supabase.from("vault_links").upsert({ user_id: userId, source_note_id: brandHub.id, target_note_id: entityNote.id }, { onConflict: "source_note_id,target_note_id" })
  await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
}

export async function extractFacts(
  conversationId: string,
  userId: string,
  extraction: ExtractionResult
) {
  const supabase = createAdminClient()

  const { data: conv } = await supabase.from("conversations").select("agenda").eq("id", conversationId).single()
  let agenda: Agenda = (conv?.agenda as Agenda) ?? { current: null, pending: [] }

  // Guard against old agenda schema missing new fields
  if (agenda.current) {
    agenda.current.attributes ??= []
    agenda.current.turns ??= 0
  }

  const { data: vaultNotes } = await supabase.from("vault_notes").select("title").eq("user_id", userId).eq("source", "conversation")
  const knownTitles = new Set([
    agenda.current?.title,
    ...agenda.pending.map((p) => p.title),
    ...(vaultNotes ?? []).map((n) => n.title),
  ].filter(Boolean) as string[])

  // Merge new attributes into current entity buffer
  if (agenda.current && extraction.attributes.length) {
    const existingKeys = new Set(agenda.current.attributes.map((a) => a.title))
    for (const attr of extraction.attributes) {
      if (!existingKeys.has(attr.title)) agenda.current.attributes.push(attr)
    }
  }

  if (agenda.current) {
    agenda.current.turns += 1
    agenda.current.missing = getMissingAttrs(agenda.current.topic, attrsToContentMd(agenda.current.attributes))

    if (agenda.current.missing.length === 0 || agenda.current.turns >= ABANDON_AFTER_TURNS) {
      await writeEntityToVault(supabase, userId, conversationId, agenda.current)
      agenda.current = agenda.pending.shift() ?? null
    }
  }

  // Add newly detected entities to agenda (skip already tracked)
  for (const entity of extraction.entities) {
    if (knownTitles.has(entity.title)) continue
    const item = makeAgendaItem(entity)
    if (!agenda.current) agenda.current = item
    else agenda.pending.push(item)
  }

  await supabase.from("conversations").update({ agenda }).eq("id", conversationId)
}

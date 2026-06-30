import { createAdminClient } from "@/lib/supabase/admin"
import { type Agenda, type AgendaItem } from "./checklists"
import { getTier1Missing, type EntityType } from "./entityTypes"
import { affiliateCategory } from "@/lib/ads/categories"

// Intents are the advertiser layer's core signal: cheap to bank now, expensive to
// reconstruct later. One open row per intent-bearing entity, with an expiry.
const INTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000 // ponytail: flat 30d; per-category TTL when it matters

async function recordIntent(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  item: AgendaItem,
  entityNoteId: string
) {
  if (!item.intent) return
  // Don't duplicate an open intent if the entity gets re-written
  const { data: existing } = await supabase
    .from("intents")
    .select("id")
    .eq("entity_note_id", entityNoteId)
    .eq("status", "open")
    .maybeSingle()
  if (existing) return

  await supabase.from("intents").insert({
    user_id: userId,
    entity_note_id: entityNoteId,
    category: affiliateCategory(item.tags[0] ?? item.entity_type),
    utterance: item.intent_utterance ?? "",
    confidence: item.intent_confidence ?? 0,
    status: "open",
    expires_at: new Date(Date.now() + INTENT_TTL_MS).toISOString(),
  })
}

export type Attr = { title: string; value: string; inferred?: boolean }
export type RawEntity = {
  title: string
  topic: string
  brand: string | null
  entity_type: "item" | "brand" | "place" | "event" | "person"
  tags: string[]
  intent: boolean
  intent_confidence?: number
  intent_utterance?: string
  scheduled_for: string | null
  description: string
  attributes?: Attr[]
}
export type ExtractionResult = { attributes: Attr[]; entities: RawEntity[] }

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function attrsToContentMd(attrs: Attr[]): string {
  return attrs.map((a) => `- **${a.title}**: ${a.value}${a.inferred ? " *(inferred)*" : ""}`).join("\n")
}

function makeAgendaItem(entity: RawEntity): AgendaItem {
  const seedAttrs = entity.attributes ?? []
  // Synthesize Brand attr from entity.brand so getTier1Missing sees it as fulfilled
  if (entity.brand && !seedAttrs.some((a) => a.title === "Brand")) {
    seedAttrs.unshift({ title: "Brand", value: entity.brand })
  }
  const seedMd = attrsToContentMd(seedAttrs)
  const tags = entity.tags?.length ? entity.tags : entity.topic ? [entity.topic] : []
  const tier1Missing = getTier1Missing(entity.entity_type as EntityType, seedMd)
  return {
    title: entity.title,
    topic: tags[0] ?? entity.entity_type,
    brand: entity.brand ?? null,
    entity_type: entity.entity_type as EntityType,
    intent: entity.intent ?? false,
    intent_utterance: entity.intent_utterance ?? "",
    intent_confidence: entity.intent_confidence ?? 0,
    scheduled_for: entity.scheduled_for ?? null,
    description: entity.description ?? "",
    missing: tier1Missing,
    attributes: seedAttrs,
    turns: 0,
    weight: 1,
    tier1_complete: tier1Missing.length === 0,
    tags,
  }
}

async function writeEntityToVault(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  conversationId: string,
  item: AgendaItem
) {
  const entityDir = item.entity_type
  const primaryTopic = item.tags[0] ?? item.entity_type

  const incompleteHeader = item.tier1_complete ? "" : "---\nincomplete: true\n---\n\n"
  const attrLines = attrsToContentMd(item.attributes)
  const fullContent = incompleteHeader + [item.description, attrLines].filter(Boolean).join("\n\n")

  // Create shared-tag edges to other conversation notes with the same topic
  async function linkByTag(entityNoteId: string) {
    const { data: peers } = await supabase
      .from("vault_notes")
      .select("id")
      .eq("user_id", userId)
      .eq("topic", primaryTopic)
      .eq("source", "conversation")
      .neq("id", entityNoteId)
      .order("created_at", { ascending: false })
      .limit(5)

    if (peers?.length) {
      await supabase.from("vault_links").upsert(
        peers.map((p) => ({
          user_id: userId,
          source_note_id: entityNoteId,
          target_note_id: p.id,
          link_type: "tag",
          anchor_text: primaryTopic,
        })),
        { onConflict: "source_note_id,target_note_id", ignoreDuplicates: true }
      )
    }
  }

  if (!item.brand) {
    const entityPath = `${entityDir}/${toSlug(item.title)}.md`
    const { data: entityNote } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: entityPath, title: item.title, topic: primaryTopic, entity_type: item.entity_type, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()
    if (!entityNote) return
    await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
    await linkByTag(entityNote.id)
    await recordIntent(supabase, userId, item, entityNote.id)
    return
  }

  const brandPath = `${entityDir}/${toSlug(item.brand)}.md`

  if (item.entity_type === "brand") {
    const { data: existing } = await supabase.from("vault_notes").select("id, content_md").eq("user_id", userId).eq("path", brandPath).maybeSingle()
    if (existing) {
      if (!existing.content_md?.includes(item.description)) {
        const updated = existing.content_md ? `${existing.content_md}\n- ${item.description}` : `- ${item.description}`
        await supabase.from("vault_notes").update({ content_md: updated }).eq("id", existing.id)
      }
    } else {
      const { data: brandNote } = await supabase
        .from("vault_notes")
        .insert({ user_id: userId, path: brandPath, title: item.brand, topic: primaryTopic, entity_type: "brand", content_md: `- ${item.description}`, source: "system", confidence: 1 })
        .select("id")
        .single()
      if (!brandNote) return
      await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: brandNote.id })
    }
    return
  }

  // Brand hub → Item
  const { data: brandHub } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: brandPath, title: item.brand, topic: primaryTopic, entity_type: "brand", content_md: "", source: "system", confidence: 1 },
      { onConflict: "user_id,path" }
    )
    .select("id")
    .single()
  if (!brandHub) return

  const entityPath = `${entityDir}/${toSlug(item.brand)}/${toSlug(item.title)}.md`
  const { data: entityNote } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: entityPath, title: item.title, topic: primaryTopic, entity_type: item.entity_type, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
      { onConflict: "user_id,path" }
    )
    .select("id")
    .single()
  if (!entityNote) return

  await supabase.from("vault_links").upsert(
    { user_id: userId, source_note_id: brandHub.id, target_note_id: entityNote.id, link_type: "brand", anchor_text: item.brand },
    { onConflict: "source_note_id,target_note_id" }
  )
  await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
  await linkByTag(entityNote.id)
  await recordIntent(supabase, userId, item, entityNote.id)
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
    agenda.current.weight ??= 1
    agenda.current.tier1_complete ??= false
    agenda.current.tags ??= []
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
      // Sync brand attr to agenda.current.brand so vault path is correct
      if (attr.title === "Brand" && !agenda.current.brand) agenda.current.brand = attr.value
    }
  }

  if (agenda.current) {
    agenda.current.turns += 1

    // Gravity: increment weight each turn, double penalty if tier 1 still incomplete
    const contentMd = attrsToContentMd(agenda.current.attributes)
    const tier1Missing = getTier1Missing(agenda.current.entity_type, contentMd)
    agenda.current.tier1_complete = tier1Missing.length === 0
    agenda.current.missing = tier1Missing
    agenda.current.weight += 1
    if (!agenda.current.tier1_complete) agenda.current.weight += 1

    if (agenda.current.tier1_complete || agenda.current.weight >= 10) {
      await writeEntityToVault(supabase, userId, conversationId, agenda.current)
      // Sort pending by weight descending before promoting
      agenda.pending.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))
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

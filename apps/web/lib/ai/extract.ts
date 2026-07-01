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

// A place's or person's identity is its name. Once a Name attribute arrives, adopt it
// as the title so the node isn't stranded under a generic placeholder ("Mall" →
// "Galeria Rzeszow"). Items keep their category-noun title (they have no Name).
function applyNameAsTitle(item: AgendaItem) {
  if (item.entity_type !== "place" && item.entity_type !== "person") return
  const name = item.attributes.find((a) => a.title.toLowerCase() === "name")?.value?.trim()
  if (name && name.toLowerCase() !== item.title.toLowerCase()) item.title = name
}

// Merge a batch of attributes into an agenda item (dedup by title, keep first-seen value),
// sync brand, and re-derive the title from any Name. Shared by the current-entity drill
// buffer and late-fact merges into known entities.
function mergeAttrs(item: AgendaItem, attrs: Attr[] | undefined) {
  const keys = new Set(item.attributes.map((a) => a.title.toLowerCase()))
  for (const a of attrs ?? []) {
    const k = a.title.toLowerCase()
    if (!keys.has(k)) { item.attributes.push(a); keys.add(k) }
    if (k === "brand" && !item.brand) item.brand = a.value
  }
  applyNameAsTitle(item)
}

// Recover description + attributes from a vault note's content_md (the format
// writeEntityToVault emits), so a flushed node can be re-opened and merged.
function parseNote(md: string): { description: string; attributes: Attr[] } {
  const body = md.replace(/^---\n[\s\S]*?\n---\n*/, "")
  const attributes: Attr[] = []
  const descLines: string[] = []
  for (const line of body.split("\n")) {
    const m = line.match(/^- \*\*(.+?)\*\*:\s*(.+?)(\s*\*\(inferred\)\*)?$/)
    if (m) attributes.push({ title: m[1], value: m[2].trim(), inferred: !!m[3] })
    else if (line.trim()) descLines.push(line.trim())
  }
  return { description: descLines.join(" "), attributes }
}

type ConvNote = { title: string; topic: string | null; content_md: string | null; entity_type: string | null; intent: boolean | null }

// Reconstruct an AgendaItem from an already-flushed node, merging in newly-stated
// attributes. Re-running writeEntityToVault on it upserts the SAME node (by path),
// folding the late facts in and recomputing the incomplete flag.
function nodeToAgendaItem(note: ConvNote, entity: RawEntity): AgendaItem {
  const parsed = parseNote(note.content_md ?? "")
  const item: AgendaItem = {
    title: note.title,
    topic: note.topic ?? note.entity_type ?? "",
    brand: parsed.attributes.find((a) => a.title.toLowerCase() === "brand")?.value ?? null,
    entity_type: note.entity_type as EntityType,
    intent: note.intent || entity.intent,
    intent_utterance: entity.intent_utterance ?? "",
    intent_confidence: entity.intent_confidence ?? 0,
    scheduled_for: entity.scheduled_for ?? null,
    description: parsed.description || entity.description || "",
    missing: [],
    attributes: parsed.attributes,
    turns: 0,
    weight: 1,
    tier1_complete: false,
    tags: note.topic ? [note.topic] : [],
  }
  mergeAttrs(item, entity.attributes)
  const tier1Missing = getTier1Missing(item.entity_type, attrsToContentMd(item.attributes))
  item.missing = tier1Missing
  item.tier1_complete = tier1Missing.length === 0
  return item
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
  const item: AgendaItem = {
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
  applyNameAsTitle(item)
  return item
}

// One canonical brand node per brand, always at brand/<slug>.md — used both for a
// standalone brand entity and as the hub an item hangs off. Appends the description
// rather than overwriting, so an item flush never blanks a brand's existing notes.
async function upsertBrandHub(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  conversationId: string,
  item: AgendaItem,
  primaryTopic: string
): Promise<string | null> {
  const brandPath = `brand/${toSlug(item.brand!)}.md`
  const { data: existing } = await supabase
    .from("vault_notes")
    .select("id, content_md")
    .eq("user_id", userId)
    .eq("path", brandPath)
    .maybeSingle()

  if (existing) {
    if (item.description && !existing.content_md?.includes(item.description)) {
      const updated = existing.content_md ? `${existing.content_md}\n- ${item.description}` : `- ${item.description}`
      await supabase.from("vault_notes").update({ content_md: updated }).eq("id", existing.id)
    }
    return existing.id
  }

  const { data: created } = await supabase
    .from("vault_notes")
    .insert({ user_id: userId, path: brandPath, title: item.brand, topic: primaryTopic, entity_type: "brand", content_md: item.description ? `- ${item.description}` : "", source: "system", confidence: 1 })
    .select("id")
    .single()
  if (!created) return null
  await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: created.id })
  return created.id
}

async function writeEntityToVault(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  conversationId: string,
  item: AgendaItem
) {
  // Single write chokepoint — ensure a captured Name has become the title (mutates the
  // shared agenda item too, so #3's title-matching sees the stable name)
  applyNameAsTitle(item)
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

  // Brand entity, or item that belongs to a brand → ensure one canonical brand hub
  const brandHubId = await upsertBrandHub(supabase, userId, conversationId, item, primaryTopic)
  if (item.entity_type === "brand" || !brandHubId) return

  // Item hangs under the brand: item/<brand>/<item>.md, linked to the brand/<brand>.md hub
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
    { user_id: userId, source_note_id: brandHubId, target_note_id: entityNote.id, link_type: "brand", anchor_text: item.brand },
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

  const { data: vaultNotes } = await supabase
    .from("vault_notes")
    .select("title, topic, content_md, entity_type, intent")
    .eq("user_id", userId)
    .eq("source", "conversation")
  const noteByTitle = new Map<string, ConvNote>()
  for (const n of (vaultNotes ?? []) as ConvNote[]) noteByTitle.set(n.title.toLowerCase(), n)

  // Merge the drill-down bucket into the current entity buffer
  if (agenda.current && extraction.attributes.length) mergeAttrs(agenda.current, extraction.attributes)

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

  // Flush any pending items that already have tier 1 complete — no reason to wait
  const stillPending: typeof agenda.pending = []
  for (const item of agenda.pending) {
    const contentMd = attrsToContentMd(item.attributes)
    const tier1Missing = getTier1Missing(item.entity_type, contentMd)
    if (tier1Missing.length === 0) {
      item.tier1_complete = true
      await writeEntityToVault(supabase, userId, conversationId, item)
    } else {
      stillPending.push(item)
    }
  }
  agenda.pending = stillPending

  // Route detected entities: merge late facts into a known entity, else add as new.
  for (const entity of extraction.entities) {
    const key = entity.title.toLowerCase()

    if (agenda.current && agenda.current.title.toLowerCase() === key) {
      mergeAttrs(agenda.current, entity.attributes)
      continue
    }
    const pendingMatch = agenda.pending.find((p) => p.title.toLowerCase() === key)
    if (pendingMatch) {
      mergeAttrs(pendingMatch, entity.attributes)
      continue
    }
    // Already flushed → fold the late facts into the durable node now (re-open by title)
    const noteMatch = noteByTitle.get(key)
    if (noteMatch) {
      await writeEntityToVault(supabase, userId, conversationId, nodeToAgendaItem(noteMatch, entity))
      continue
    }
    const item = makeAgendaItem(entity)
    if (!agenda.current) agenda.current = item
    else agenda.pending.push(item)
  }

  await supabase.from("conversations").update({ agenda }).eq("id", conversationId)
}

// Session close (farewell or 2h timeout). Hybrid persistence: intent-bearing entities
// are banked to the vault now as incomplete nodes — the ad signal is cheap to capture
// here and expensive to reconstruct, and they resurface via "Unfinished from last
// session". Everything else is returned as survivors for the next session to carry
// forward in its pending queue. Idempotent: recordIntent dedups, upserts are by path.
export async function closeSession(conversationId: string, userId: string): Promise<AgendaItem[]> {
  const supabase = createAdminClient()
  const { data: conv } = await supabase.from("conversations").select("agenda").eq("id", conversationId).single()
  const agenda: Agenda = (conv?.agenda as Agenda) ?? { current: null, pending: [] }

  const queue = [...(agenda.current ? [agenda.current] : []), ...agenda.pending]
  const survivors: AgendaItem[] = []
  for (const item of queue) {
    if (item.intent) await writeEntityToVault(supabase, userId, conversationId, item)
    else survivors.push({ ...item, turns: 0, weight: 1 })
  }

  await supabase.from("conversations").update({ agenda: { current: null, pending: survivors } }).eq("id", conversationId)
  return survivors
}

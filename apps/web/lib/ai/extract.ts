import { createAdminClient } from "@/lib/supabase/admin"
import { type Agenda, type AgendaItem } from "./checklists"
import { getTier1Missing, type EntityType } from "./entityTypes"
import { affiliateCategory } from "@/lib/ads/categories"
import { resolveRelation } from "./relations"

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
  entity_type: "item" | "brand" | "place" | "event" | "person" | "org"
  tags: string[]
  intent: boolean
  intent_confidence?: number
  intent_utterance?: string
  scheduled_for: string | null
  description: string
  attributes?: Attr[]
  relations?: { to: string; label: string }[]
  refines?: string
}
export type ExtractionResult = { attributes: Attr[]; entities: RawEntity[]; user_age?: number; user_home_location?: string }

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

function attrsToContentMd(attrs: Attr[]): string {
  return attrs.map((a) => `- **${a.title}**: ${a.value}${a.inferred ? " *(inferred)*" : ""}`).join("\n")
}

// Merge an incoming extracted entity into an existing tracked agenda item: fold its
// attributes (via mergeAttrs) and carry a forward-looking intent it may bring ("I need
// blue linen pants" refining the tracked "Pants"). The target keeps its canonical title.
function mergeEntity(target: AgendaItem, entity: RawEntity) {
  mergeAttrs(target, entity.attributes)
  if (entity.intent && !target.intent) {
    target.intent = true
    target.intent_utterance = entity.intent_utterance ?? ""
    target.intent_confidence = entity.intent_confidence ?? 0
  }
}

// A place's, person's, or org's identity is its name. Once a Name attribute arrives, adopt
// it as the title so the node isn't stranded under a generic placeholder ("Mall" →
// "Galeria Rzeszow", "my job" → "Acme"). Items keep their category-noun title (no Name).
function applyNameAsTitle(item: AgendaItem) {
  if (item.entity_type !== "place" && item.entity_type !== "person" && item.entity_type !== "org") return
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

type ConvNote = { title: string; topic: string | null; content_md: string | null; entity_type: string | null; intent: boolean | null; path: string }

// Reconstruct an AgendaItem from an already-flushed node, merging in newly-stated
// attributes. Re-running writeEntityToVault on it upserts the SAME node (by path),
// folding the late facts in and recomputing the incomplete flag.
function nodeToAgendaItem(note: ConvNote, entity: RawEntity): AgendaItem {
  const parsed = parseNote(note.content_md ?? "")
  const item: AgendaItem = {
    title: note.title,
    topic: note.topic ?? note.entity_type ?? "",
    brand: parsed.attributes.find((a) => a.title.toLowerCase() === "brand")?.value ?? entity.brand ?? null,
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
  // Mirror makeAgendaItem: synthesize Brand attr from item.brand if missing, so the brand hub + edge are created on re-open.
  if (item.brand && !item.attributes.some((a) => a.title.toLowerCase() === "brand")) {
    item.attributes.unshift({ title: "Brand", value: item.brand })
  }
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
  item: AgendaItem,
  existingPath?: string
) {
  // Single write chokepoint — ensure a captured Name has become the title (mutates the
  // shared agenda item too, so #3's title-matching sees the stable name)
  applyNameAsTitle(item)
  const entityDir = item.entity_type
  const primaryTopic = item.tags[0] ?? item.entity_type

  // An intent-bearing item is a want, not a possession — read that off the node itself via a
  // deterministic "New " prefix (not left to the model). Kept as a display/path title only;
  // item.title stays the bare noun so agenda + refine-by-title matching is unaffected.
  const displayTitle =
    item.intent && item.entity_type === "item" && !/^new /i.test(item.title)
      ? `New ${item.title}`
      : item.title

  const incompleteHeader = item.tier1_complete ? "" : "---\nincomplete: true\n---\n\n"
  const attrLines = attrsToContentMd(item.attributes)
  const fullContent = incompleteHeader + [item.description, attrLines].filter(Boolean).join("\n\n")

  if (!item.brand) {
    // Re-opened nodes keep their original path so a later brand/name doesn't relocate them into a duplicate.
    const entityPath = existingPath ?? `${entityDir}/${toSlug(displayTitle)}.md`
    const { data: entityNote } = await supabase
      .from("vault_notes")
      .upsert(
        { user_id: userId, path: entityPath, title: displayTitle, topic: primaryTopic, entity_type: item.entity_type, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
        { onConflict: "user_id,path" }
      )
      .select("id")
      .single()
    if (!entityNote) return
    await supabase.from("extractions").insert({ conversation_id: conversationId, note_id: entityNote.id })
    await recordIntent(supabase, userId, item, entityNote.id)
    return
  }

  // Brand entity, or item that belongs to a brand → ensure one canonical brand hub
  const brandHubId = await upsertBrandHub(supabase, userId, conversationId, item, primaryTopic)
  if (item.entity_type === "brand" || !brandHubId) return

  // Item hangs under the brand: item/<brand>/<item>.md, linked to the brand/<brand>.md hub
  // Re-opened nodes keep their original path so a later brand/name doesn't relocate them into a duplicate.
  const entityPath = existingPath ?? `${entityDir}/${toSlug(item.brand)}/${toSlug(displayTitle)}.md`
  const { data: entityNote } = await supabase
    .from("vault_notes")
    .upsert(
      { user_id: userId, path: entityPath, title: displayTitle, topic: primaryTopic, entity_type: item.entity_type, content_md: fullContent, intent: item.intent, scheduled_for: item.scheduled_for, source: "conversation", confidence: 0.8 },
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
  await recordIntent(supabase, userId, item, entityNote.id)
}

export async function extractFacts(
  conversationId: string,
  userId: string,
  extraction: ExtractionResult
) {
  const supabase = createAdminClient()

  // User self-facts (age, home location) live on the profile, not the graph. Read-merge-write
  // so a newly-learned age doesn't clobber an existing home_location and vice versa.
  if (extraction.user_age || extraction.user_home_location) {
    const { data: prof } = await supabase.from("profiles").select("base_profile").eq("id", userId).single()
    const base = { ...((prof?.base_profile as Record<string, unknown>) ?? {}) }
    if (extraction.user_age) base.age = extraction.user_age
    if (extraction.user_home_location) base.home_location = extraction.user_home_location
    await supabase.from("profiles").update({ base_profile: base }).eq("id", userId)
  }

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
    .select("title, topic, content_md, entity_type, intent, path")
    .eq("user_id", userId)
    .eq("source", "conversation")
  const noteByTitle = new Map<string, ConvNote>()
  for (const n of (vaultNotes ?? []) as ConvNote[]) {
    noteByTitle.set(n.title.toLowerCase(), n)
    // Alias the bare noun so a re-emitted "Pants" re-opens the intent-prefixed "New pants" node.
    const bare = n.title.replace(/^new /i, "").toLowerCase()
    if (!noteByTitle.has(bare)) noteByTitle.set(bare, n)
  }

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
    // refines points at an existing entity this one refines; fall back to exact title.
    const key = (entity.refines?.trim() || entity.title).toLowerCase()

    if (agenda.current && agenda.current.title.toLowerCase() === key) {
      mergeEntity(agenda.current, entity)
      continue
    }
    const pendingMatch = agenda.pending.find((p) => p.title.toLowerCase() === key)
    if (pendingMatch) {
      mergeEntity(pendingMatch, entity)
      continue
    }
    // Already flushed → fold the late facts into the durable node now (re-open by title)
    const noteMatch = noteByTitle.get(key)
    if (noteMatch) {
      await writeEntityToVault(supabase, userId, conversationId, nodeToAgendaItem(noteMatch, entity), noteMatch.path)
      continue
    }
    const item = makeAgendaItem(entity)
    if (!agenda.current) agenda.current = item
    else agenda.pending.push(item)
  }

  // Relationship post-pass: connect entities to each other with model-emitted labels.
  // Best-effort — re-query all conversation nodes (now that this turn's writes have landed),
  // resolve source+target titles to ids, upsert 'relation' edges. Unresolved endpoints
  // (e.g. an entity still pending, not yet a node) are skipped; the model re-emits the
  // relation on later turns and the edge forms once both nodes exist (self-healing).
  const rels = extraction.entities.flatMap((e) =>
    (e.relations ?? []).map((r) => ({ from: e.refines?.trim() || e.title, to: r.to, label: r.label }))
  )
  if (rels.length) {
    const { data: allNotes } = await supabase
      .from("vault_notes")
      .select("id, title")
      .eq("user_id", userId)
      .eq("source", "conversation")
    // Resolved against CURRENT titles — pre-rename refs (e.g. "Mall" before "Galeria Rzeszow") silently miss and self-heal when re-emitted with the final title.
    const idByTitle = new Map<string, string>()
    for (const n of allNotes ?? []) idByTitle.set(n.title.toLowerCase(), n.id)

    const edges = []
    const seen = new Set<string>()
    for (const rel of rels) {
      const resolved = resolveRelation(idByTitle, rel.from, rel.to)
      if (!resolved) continue
      const key = `${resolved.source}->${resolved.target}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({
        user_id: userId,
        source_note_id: resolved.source,
        target_note_id: resolved.target,
        link_type: "relation" as const,
        anchor_text: rel.label.slice(0, 40),
      })
    }
    if (edges.length) {
      await supabase.from("vault_links").upsert(edges, { onConflict: "source_note_id,target_note_id", ignoreDuplicates: true })
    }
  }

  await supabase.from("conversations").update({ agenda }).eq("id", conversationId)
}

// Session close (farewell or 2h timeout). Persist EVERY pending + current entity to the
// vault now (incomplete flag when tier-1 unmet — writeEntityToVault sets it; recordIntent
// fires for intent-bearing ones). Nothing mentioned is lost: complete ones become known
// facts, incomplete ones resurface next session via "Unfinished from last session". The
// agenda is emptied; the next conversation starts fresh. Idempotent: upserts are by path.
export async function closeSession(conversationId: string, userId: string): Promise<void> {
  const supabase = createAdminClient()
  const { data: conv } = await supabase.from("conversations").select("agenda").eq("id", conversationId).single()
  const agenda: Agenda = (conv?.agenda as Agenda) ?? { current: null, pending: [] }

  const queue = [...(agenda.current ? [agenda.current] : []), ...agenda.pending]
  for (const item of queue) {
    // Recompute completeness from the item's current attributes before writing.
    const tier1Missing = getTier1Missing(item.entity_type, attrsToContentMd(item.attributes))
    item.tier1_complete = tier1Missing.length === 0
    await writeEntityToVault(supabase, userId, conversationId, item)
  }

  await supabase.from("conversations").update({ agenda: { current: null, pending: [] } }).eq("id", conversationId)
}

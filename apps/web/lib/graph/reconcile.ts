import { createAdminClient } from "@/lib/supabase/admin"
import { logEvent } from "@/lib/admin/logEvent"
import { ENTITY_TYPES, type EntityType } from "@/lib/ai/entityTypes"

// The Gardener — a batch pass over the WHOLE graph that streaming extraction can't do:
// merge duplicates, re-parent orphans, re-type mistyped nodes, drop broken ones.
// Cleanup-only v1 (no synthesis — no new nodes, no affinity/sizing/budget layer; phase 3).
//
// Same dual-provider pattern as lib/ai/synthesize.ts: Gemini 2.5 Flash primary
// (GEMINI_API_KEY), Cerebras gpt-oss-120b one-call fallback (CEREBRAS_API_KEY),
// strict JSON schema, temperature 0, no thinking budget (this is a classification
// task, not reasoning).
const GEMINI_MODEL = "gemini-2.5-flash"
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY
const CEREBRAS_MODEL = "gpt-oss-120b"

// Guardrails against a bad or runaway pass: ops the model is unsure about are dropped,
// and a single run can only ever touch a bounded number of nodes.
// ponytail: conservative floor for an eventually-unattended pass — a wrong 0.70 inference
// (e.g. laptop→employer when the note says "personal use") is filtered. Lower if it proves too strict.
const CONFIDENCE_THRESHOLD = 0.75
const MAX_OPS_PER_RUN = 20

// ============================================================
// Types
// ============================================================

export type GardenNode = {
  id: string
  title: string
  entity_type: string | null
  topic: string | null
  content_md: string | null
  intent: boolean | null
  path: string
}

export type GardenEdge = {
  id: string
  source_note_id: string
  target_note_id: string
  link_type: string | null
  anchor_text: string | null
}

// The validated, ready-to-apply op union. Every op carries reason + confidence for
// provenance/logging. Ops reference node IDS ONLY — never titles (ambiguous, and titles
// can change out from under an op mid-run).
export type GardenOp =
  | { op: "merge"; from_id: string; into_id: string; reason: string; confidence: number }
  | { op: "retype"; id: string; entity_type: EntityType; reason: string; confidence: number }
  | { op: "add_edge"; from_id: string; to_id: string; label: string; reason: string; confidence: number }
  | { op: "drop"; id: string; reason: string; confidence: number }

// The LLM's raw, un-validated shape. Strict-schema structured output can't express a
// discriminated union cleanly (Gemini's OpenAPI-subset schema has no oneOf/anyOf), so the
// model always returns one flat object per op with every field present; fields that don't
// apply to that op's kind come back as "". validateOps below is what actually enforces
// the union's shape.
type RawGardenOp = {
  op: string
  id: string
  from_id: string
  into_id: string
  to_id: string
  entity_type: string
  label: string
  reason: string
  confidence: number
}

// ============================================================
// Pure logic — no DB, no LLM. Testable in isolation (see self-check at bottom).
// ============================================================

type ParsedNote = { header: string; description: string; attrs: { title: string; value: string; inferred?: boolean }[] }

// Mirrors the content_md shape writeEntityToVault (lib/ai/extract.ts) writes:
// optional "incomplete" frontmatter header, then description, then "- **Title**: value" lines.
function parseContentMd(md: string | null): ParsedNote {
  const raw = md ?? ""
  const headerMatch = raw.match(/^(---\n[\s\S]*?\n---\n*)/)
  const header = headerMatch ? headerMatch[1] : ""
  const body = header ? raw.slice(header.length) : raw
  const attrs: ParsedNote["attrs"] = []
  const descLines: string[] = []
  for (const line of body.split("\n")) {
    const m = line.match(/^- \*\*(.+?)\*\*:\s*(.+?)(\s*\*\(inferred\)\*)?$/)
    if (m) attrs.push({ title: m[1], value: m[2].trim(), inferred: !!m[3] })
    else if (line.trim()) descLines.push(line.trim())
  }
  return { header, description: descLines.join(" "), attrs }
}

function attrsToLines(attrs: ParsedNote["attrs"]): string {
  return attrs.map((a) => `- **${a.title}**: ${a.value}${a.inferred ? " *(inferred)*" : ""}`).join("\n")
}

// Fold a merge-source's content into the merge-target's: dedup attributes by title
// (case-insensitive), KEEP THE TARGET'S VALUE on a collision, append any attribute the
// target lacks, and append the source's description if the target doesn't already have it.
// Idempotent: folding the same source in twice adds nothing the second time (its attrs are
// already keyed in, its description already appears as a substring).
export function foldAttributes(intoContentMd: string | null, fromContentMd: string | null): string {
  const into = parseContentMd(intoContentMd)
  const from = parseContentMd(fromContentMd)

  const keys = new Set(into.attrs.map((a) => a.title.toLowerCase()))
  const mergedAttrs = [...into.attrs]
  for (const a of from.attrs) {
    const k = a.title.toLowerCase()
    if (keys.has(k)) continue // target's value wins
    mergedAttrs.push(a)
    keys.add(k)
  }

  let description = into.description
  if (from.description && !description.includes(from.description)) {
    description = description ? `${description} ${from.description}` : from.description
  }

  return into.header + [description, attrsToLines(mergedAttrs)].filter(Boolean).join("\n\n")
}

type Edge = { source: string; target: string; link_type: string | null; anchor_text: string | null }

// Drop duplicate (source,target) pairs, keeping the first occurrence. Generic over any
// edge-shaped object so it composes with repointEdges below.
export function dedupeEdges<T extends { source: string; target: string }>(edges: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const e of edges) {
    const key = `${e.source}->${e.target}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

// After a merge, every edge that touched the archived "from" node must point at "into"
// instead. Drops self-loops (an edge that now points into→into) and de-dupes the result.
// Idempotent: re-running on an already-repointed edge list is a no-op (no edge still
// references fromId, so the map step changes nothing, and dedupe of an already-deduped
// list is stable).
export function repointEdges(edges: GardenEdge[], fromId: string, intoId: string): Edge[] {
  const mapped: Edge[] = edges.map((e) => ({
    source: e.source_note_id === fromId ? intoId : e.source_note_id,
    target: e.target_note_id === fromId ? intoId : e.target_note_id,
    link_type: e.link_type,
    anchor_text: e.anchor_text,
  }))
  return dedupeEdges(mapped.filter((e) => e.source !== e.target))
}

// Validate + filter the LLM's raw op list into the strict GardenOp union: reject ops that
// reference an unknown node id, ops below the confidence threshold, and enforce a hard cap
// on the number of ops a single run can apply (guards against a runaway/bad pass).
export function validateOps(
  rawOps: RawGardenOp[],
  nodeIdSet: Set<string>,
  threshold: number = CONFIDENCE_THRESHOLD,
  cap: number = MAX_OPS_PER_RUN
): GardenOp[] {
  const valid: GardenOp[] = []
  for (const raw of rawOps) {
    if (valid.length >= cap) break
    const confidence = typeof raw.confidence === "number" ? raw.confidence : 0
    if (confidence < threshold) continue
    const reason = raw.reason ?? ""

    if (raw.op === "merge") {
      if (!raw.from_id || !raw.into_id) continue
      if (raw.from_id === raw.into_id) continue
      if (!nodeIdSet.has(raw.from_id) || !nodeIdSet.has(raw.into_id)) continue
      valid.push({ op: "merge", from_id: raw.from_id, into_id: raw.into_id, reason, confidence })
    } else if (raw.op === "retype") {
      if (!raw.id || !raw.entity_type) continue
      if (!nodeIdSet.has(raw.id)) continue
      if (!(ENTITY_TYPES as readonly string[]).includes(raw.entity_type)) continue
      valid.push({ op: "retype", id: raw.id, entity_type: raw.entity_type as EntityType, reason, confidence })
    } else if (raw.op === "add_edge") {
      if (!raw.from_id || !raw.to_id || !raw.label) continue
      if (raw.from_id === raw.to_id) continue
      if (!nodeIdSet.has(raw.from_id) || !nodeIdSet.has(raw.to_id)) continue
      valid.push({ op: "add_edge", from_id: raw.from_id, to_id: raw.to_id, label: raw.label, reason, confidence })
    } else if (raw.op === "drop") {
      if (!raw.id) continue
      if (!nodeIdSet.has(raw.id)) continue
      valid.push({ op: "drop", id: raw.id, reason, confidence })
    }
    // unknown op kind: silently skip
  }
  return valid
}

// Compact serialization for the LLM prompt — ids first (ops must target them), then just
// enough of each node to judge duplicates/mistypes/orphans without burning tokens on full
// content_md. Edges as a simple arrow list.
export function serializeGraph(nodes: GardenNode[], edges: GardenEdge[]): string {
  const nodeLines = nodes.map((n) => {
    const { description, attrs } = parseContentMd(n.content_md)
    const gist = description ? description.slice(0, 80) : attrs.slice(0, 2).map((a) => `${a.title}: ${a.value}`).join(", ")
    return `${n.id} | ${n.entity_type ?? "?"} | ${n.title} | ${n.topic ?? "-"} | ${gist}`
  })
  const edgeLines = edges.map((e) => `${e.source_note_id} -${e.anchor_text || e.link_type || "relation"}-> ${e.target_note_id}`)
  return `NODES (id | type | title | topic | gist):\n${nodeLines.join("\n") || "(none)"}\n\nEDGES (source -label-> target):\n${edgeLines.join("\n") || "(none)"}`
}

// ============================================================
// LLM call — schema + prompt
// ============================================================

const OP_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    op: { type: "string", enum: ["merge", "retype", "add_edge", "drop"] },
    id: { type: "string", description: "target node id for retype/drop. Empty string for merge/add_edge." },
    from_id: { type: "string", description: "duplicate node id for merge, or source node id for add_edge. Empty string for retype/drop." },
    into_id: { type: "string", description: "surviving node id for merge. Empty string otherwise." },
    to_id: { type: "string", description: "target node id for add_edge. Empty string otherwise." },
    // No enum here (unlike `op`): Gemini's schema validator rejects an enum that includes
    // "", and "" is the legitimate value for every op kind except retype. validateOps checks
    // membership in ENTITY_TYPES at runtime instead.
    entity_type: { type: "string", description: `corrected entity_type for retype — one of: ${ENTITY_TYPES.join(", ")}. Empty string otherwise.` },
    label: { type: "string", description: "short verb phrase (<=3 words) for add_edge, e.g. 'in', 'at', 'via'. Empty string otherwise." },
    reason: { type: "string", description: "one-sentence justification, referencing node titles for a human reader" },
    confidence: { type: "number", description: "0-1 confidence this operation is correct" },
  },
  required: ["op", "id", "from_id", "into_id", "to_id", "entity_type", "label", "reason", "confidence"],
} as const

const OPS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ops: {
      type: "array",
      description: "Cleanup operations. Return an EMPTY array if the graph is already clean — do not invent problems.",
      items: OP_ITEM_SCHEMA,
    },
  },
  required: ["ops"],
} as const

export const GARDENER_SYSTEM = `You are the Gardener — a batch cleanup pass over a personal knowledge graph. You see the WHOLE graph at once (something streaming extraction never gets), so you can do what it can't: merge duplicates, re-parent orphans, re-type mistakes, and drop junk.

## Scope — cleanup ONLY
You do not invent new facts, new nodes, or new entities. You only reorganize what's already there. If the graph looks clean, return an EMPTY ops list — do not manufacture problems to justify a response.

## Operations
- merge: two nodes are the same real-world thing, or close enough that they should be one node (e.g. "Coding" / "Software Development" / "AI Knowledge" describing the same underlying interest). from_id is the duplicate (loses), into_id is the survivor (keeps the more complete/canonical title).
- retype: a node's entity_type is wrong (e.g. "Train" typed as item when it's really transport with no owner — retype toward a type that fits, or prefer add_edge/drop if no type fits).
- add_edge: two nodes are obviously related but have no edge (an orphan item that clearly belongs to a place/event/brand already in the graph). Put the CONTAINER (the place, brand, org, or event) as from_id and the thing that belongs to it (the item) as to_id — parent first. label is a short verb phrase (<=3 words): in, at, for, via, with.
- drop: a node is broken junk — a bare time reference used as a title, a one-off generic errand with no lasting identity, a duplicate that isn't worth merging because it's near-empty.

## Rules
- Reference nodes ONLY by their id (the first column). Never invent an id that isn't in the NODES list. Never target the same node as both endpoints of an operation.
- Every op needs a one-sentence reason (a human will read it to decide whether to trust the pass) and a confidence 0-1. If you're not confident, either omit the op or give it a low confidence — low-confidence ops are filtered out automatically.
- Prefer the least destructive fix: add_edge over merge, merge over drop.
- Do not merge two nodes just because they're the same entity_type or topic — they must genuinely be the same thing or the same identity at different grains.

Return only the structured JSON.`

// Gemini wants an OpenAPI-subset schema (uppercase types, no additionalProperties).
// Same converter as lib/ai/synthesize.ts (duplicated here rather than exported/shared —
// it's a tiny pure function and the two files evolve independently).
function toGeminiSchema(s: any): any {
  if (s.type === "object") {
    return {
      type: "OBJECT",
      properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])),
      required: s.required,
      ...(s.description ? { description: s.description } : {}),
    }
  }
  if (s.type === "array") return { type: "ARRAY", items: toGeminiSchema(s.items), ...(s.description ? { description: s.description } : {}) }
  const o: Record<string, unknown> = { type: String(s.type).toUpperCase() }
  if (s.enum) o.enum = s.enum
  if (s.description) o.description = s.description
  return o
}
const GEMINI_OPS_SCHEMA = toGeminiSchema(OPS_SCHEMA)

async function callGardenerGemini(userContent: string): Promise<RawGardenOp[]> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set")
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: GARDENER_SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_OPS_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 }, // classification, not reasoning
        temperature: 0,
        maxOutputTokens: 4000,
      },
    }),
  })
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("gemini: empty response")
  const parsed = JSON.parse(text) as { ops: RawGardenOp[] }
  return parsed.ops ?? []
}

async function callGardenerCerebras(userContent: string): Promise<RawGardenOp[]> {
  if (!CEREBRAS_KEY) throw new Error("CEREBRAS_API_KEY not set")
  const res = await fetch(CEREBRAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      max_tokens: 4000,
      response_format: { type: "json_schema", json_schema: { name: "gardener_ops", strict: true, schema: OPS_SCHEMA } },
      messages: [
        { role: "system", content: GARDENER_SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  })
  if (!res.ok) throw new Error(`cerebras ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("cerebras: empty response")
  const parsed = JSON.parse(text) as { ops: RawGardenOp[] }
  return parsed.ops ?? []
}

// ============================================================
// Apply layer — thin wrapper over the pure functions above. Only runs when
// dryRun === false. NOT atomic (matches extract.ts's style): each op is applied
// sequentially, best-effort, and is individually reversible via archived_at.
// ============================================================

const isContainmentLabel = (label: string) => ["in", "located in", "inside", "within", "part of"].includes(label.toLowerCase().trim())

// GraphCanvas nests a child UNDER its parent by edge direction: for a `relation` edge the
// TARGET is the child. An item belongs UNDER its store/place/org — so when an add_edge joins
// an item to a container, force the container to be the SOURCE (parent) no matter which way
// the model emitted it. Without this, "pasta -> Aldi" reads as "Aldi is pasta's child" and the
// item stays a root hanging off "You" (the You→pasta→Aldi inversion). Containment edges keep
// their own child→parent convention and are excluded by the caller.
const CONTAINER_TYPES = new Set(["brand", "place", "org", "event"])
export function orientItemUnderContainer(
  fromType: string | null | undefined,
  toType: string | null | undefined,
  fromId: string,
  toId: string
): { source: string; target: string } {
  if (fromType === "item" && toType !== "item" && CONTAINER_TYPES.has(toType ?? "")) {
    return { source: toId, target: fromId } // swap: container becomes parent/source
  }
  return { source: fromId, target: toId } // already container→item, or not an item/container pair
}

async function applyOp(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  op: GardenOp,
  nodeById: Map<string, GardenNode>
): Promise<void> {
  if (op.op === "merge") {
    const from = nodeById.get(op.from_id)
    const into = nodeById.get(op.into_id)
    if (!from || !into) return

    const mergedContent = foldAttributes(into.content_md, from.content_md)
    await supabase.from("vault_notes").update({ content_md: mergedContent }).eq("id", op.into_id)

    // Repoint every edge that touched the losing node onto the survivor, then dedupe.
    // Re-queried per merge (rather than reusing a run-start snapshot) so a run with
    // several merges stays correct against edges an earlier merge in the same run changed.
    const { data: linkRows } = await supabase
      .from("vault_links")
      .select("id, source_note_id, target_note_id, link_type, anchor_text")
      .eq("user_id", userId)
      .or(`source_note_id.eq.${op.from_id},target_note_id.eq.${op.from_id}`)
    const touching = (linkRows ?? []) as GardenEdge[]
    const repointed = repointEdges(touching, op.from_id, op.into_id)
    if (touching.length) await supabase.from("vault_links").delete().in("id", touching.map((e) => e.id))
    if (repointed.length) {
      await supabase.from("vault_links").upsert(
        repointed.map((e) => ({ user_id: userId, source_note_id: e.source, target_note_id: e.target, link_type: e.link_type, anchor_text: e.anchor_text })),
        { onConflict: "source_note_id,target_note_id", ignoreDuplicates: true }
      )
    }

    await supabase.from("vault_notes").update({ archived_at: new Date().toISOString() }).eq("id", op.from_id)
    logEvent("gardener_merge", { from_id: op.from_id, from_title: from.title, into_id: op.into_id, into_title: into.title, reason: op.reason, confidence: op.confidence }, userId)
    return
  }

  if (op.op === "retype") {
    await supabase.from("vault_notes").update({ entity_type: op.entity_type }).eq("id", op.id)
    logEvent("gardener_retype", { id: op.id, entity_type: op.entity_type, reason: op.reason, confidence: op.confidence }, userId)
    return
  }

  if (op.op === "add_edge") {
    const containment = isContainmentLabel(op.label)
    // Containment keeps its child→parent convention; otherwise nest an item under its container.
    const { source, target } = containment
      ? { source: op.from_id, target: op.to_id }
      : orientItemUnderContainer(nodeById.get(op.from_id)?.entity_type, nodeById.get(op.to_id)?.entity_type, op.from_id, op.to_id)
    await supabase.from("vault_links").upsert(
      { user_id: userId, source_note_id: source, target_note_id: target, link_type: containment ? "located_in" : "relation", anchor_text: op.label.slice(0, 40) },
      { onConflict: "source_note_id,target_note_id" }
    )
    logEvent("gardener_add_edge", { from_id: source, to_id: target, label: op.label, reason: op.reason, confidence: op.confidence }, userId)
    return
  }

  if (op.op === "drop") {
    await supabase.from("vault_notes").update({ archived_at: new Date().toISOString() }).eq("id", op.id)
    logEvent("gardener_drop", { id: op.id, reason: op.reason, confidence: op.confidence }, userId)
    return
  }
}

// ============================================================
// Entry point
// ============================================================

// Batch-reconciles one user's graph. Defaults to a dry run (proposes ops, applies nothing) —
// the caller must explicitly opt into dryRun: false, which this codebase does not currently
// do anywhere against real data (that's a gated, human-triggered step for later).
export async function reconcileGraph(userId: string, opts: { dryRun?: boolean } = {}): Promise<{ ops: GardenOp[]; applied: number }> {
  const dryRun = opts.dryRun ?? true
  const supabase = createAdminClient()

  const { data: noteRows } = await supabase
    .from("vault_notes")
    .select("id, title, entity_type, topic, content_md, intent, path")
    .eq("user_id", userId)
    .in("source", ["conversation", "system"])
    .is("archived_at", null)
    // The root "You" profile node (_profile.md, topic Profile) is the graph's anchor —
    // extraction depends on it (CLAUDE.md). The Gardener must never merge/retype/drop it,
    // so keep it out of the node set entirely (ops referencing it fail validateOps' id check).
    .neq("path", "_profile.md")
  const nodes = (noteRows ?? []) as GardenNode[]
  if (nodes.length < 2) return { ops: [], applied: 0 } // nothing to reconcile against

  const { data: linkRows } = await supabase
    .from("vault_links")
    .select("id, source_note_id, target_note_id, link_type, anchor_text")
    .eq("user_id", userId)
  const edges = (linkRows ?? []) as GardenEdge[]

  const nodeIdSet = new Set(nodes.map((n) => n.id))
  const prompt = serializeGraph(nodes, edges)

  let rawOps: RawGardenOp[]
  try {
    rawOps = await callGardenerGemini(prompt)
  } catch (gemErr) {
    console.error("[reconcile] Gemini failed, falling back to Cerebras:", gemErr)
    logEvent("gardener_fallback", { err: String(gemErr) }, userId)
    try {
      rawOps = await callGardenerCerebras(prompt)
    } catch (cereErr) {
      console.error("[reconcile] both providers failed:", cereErr)
      logEvent("gardener_failed_both", { err: String(cereErr) }, userId)
      return { ops: [], applied: 0 }
    }
  }

  const ops = validateOps(rawOps, nodeIdSet, CONFIDENCE_THRESHOLD, MAX_OPS_PER_RUN)
  if (dryRun) return { ops, applied: 0 }

  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  let applied = 0
  for (const op of ops) {
    try {
      await applyOp(supabase, userId, op, nodeById)
      applied++
    } catch (err) {
      console.error("[reconcile] op failed:", op, err)
      logEvent("gardener_op_failed", { op, err: String(err) }, userId)
    }
  }
  return { ops, applied }
}

// ponytail: one runnable check — `NODE_OPTIONS="--conditions=react-server" npx tsx lib/graph/reconcile.ts`
// from apps/web (the react-server condition is needed because this file transitively imports
// the "server-only" package via logEvent/admin.ts, same as synthesize.ts's self-check).
// Deterministic, no LLM, no DB — exercises only the pure functions above.
// Guard on the full relative path, not just the basename — scripts/reconcile.ts (the CLI
// trigger) imports this module and also happens to end in "reconcile.ts", which would
// otherwise trigger this self-check on every CLI invocation too.
const invokedPath = (process.argv[1] ?? "").replace(/\\/g, "/")
if (invokedPath.endsWith("lib/graph/reconcile.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }

  // ---- foldAttributes ----
  const into1 = "A grocery run.\n\n- **Category**: coding\n- **Brand**: Aldi"
  const from1 = "Programming side projects.\n\n- **Category**: software\n- **Language**: TypeScript"
  const folded1 = foldAttributes(into1, from1)
  assert(folded1.includes("**Category**: coding"), "keeps target's Category value on collision")
  assert(!folded1.includes("**Category**: software"), "does not keep source's colliding value")
  assert(folded1.includes("**Language**: TypeScript"), "adds source's non-colliding attribute")
  assert(folded1.includes("A grocery run."), "keeps target description")
  assert(folded1.includes("Programming side projects."), "appends source description")
  const foldedTwice1 = foldAttributes(folded1, from1)
  assert(foldedTwice1 === folded1, "foldAttributes is idempotent — re-folding the same source adds nothing")

  // Frontmatter header (incomplete flag) on the target is preserved through the fold.
  const intoWithHeader = "---\nincomplete: true\n---\n\nA belt.\n\n- **Category**: belt"
  const foldedHeader = foldAttributes(intoWithHeader, "- **Brand**: Zara")
  assert(foldedHeader.startsWith("---\nincomplete: true\n---\n\n"), "preserves target's frontmatter header")
  assert(foldedHeader.includes("**Brand**: Zara"), "still folds in source attrs under a header")

  // ---- edge repoint + dedupe ----
  const edges: GardenEdge[] = [
    { id: "e1", source_note_id: "dup", target_note_id: "place-1", link_type: "relation", anchor_text: "at" },
    { id: "e2", source_note_id: "survivor", target_note_id: "place-1", link_type: "relation", anchor_text: "at" }, // will collide with e1 post-repoint
    { id: "e3", source_note_id: "brand-1", target_note_id: "dup", link_type: "brand", anchor_text: "Zara" },
    { id: "e4", source_note_id: "survivor", target_note_id: "survivor", link_type: "relation", anchor_text: "self" }, // pre-existing self-loop, unrelated to the merge
  ]
  const repointed = repointEdges(edges, "dup", "survivor")
  assert(!repointed.some((e) => e.source === "dup" || e.target === "dup"), "no edge still references the archived 'from' node")
  assert(repointed.filter((e) => e.source === "survivor" && e.target === "place-1").length === 1, "duplicate (source,target) pair after repoint collapses to one")
  assert(!repointed.some((e) => e.source === "survivor" && e.target === "survivor"), "self-loop is dropped")
  assert(repointed.some((e) => e.source === "brand-1" && e.target === "survivor"), "target-side reference is repointed too")
  const repointedTwice = repointEdges(
    repointed.map((e, i) => ({ id: `r${i}`, source_note_id: e.source, target_note_id: e.target, link_type: e.link_type, anchor_text: e.anchor_text })),
    "dup",
    "survivor"
  )
  assert(JSON.stringify(repointedTwice) === JSON.stringify(repointed), "repointEdges is idempotent — re-running on an already-repointed list changes nothing")

  const dupeOnly = dedupeEdges([{ source: "a", target: "b" }, { source: "a", target: "b" }, { source: "a", target: "c" }])
  assert(dupeOnly.length === 2, "dedupeEdges collapses duplicate pairs, keeps distinct ones")

  // ---- validateOps ----
  const ids = new Set(["n1", "n2", "n3"])
  const raw: RawGardenOp[] = [
    { op: "merge", id: "", from_id: "n1", into_id: "n2", to_id: "", entity_type: "", label: "", reason: "same thing", confidence: 0.9 },
    { op: "merge", id: "", from_id: "n1", into_id: "ghost", to_id: "", entity_type: "", label: "", reason: "bad id", confidence: 0.9 }, // unknown id → rejected
    { op: "retype", id: "n3", from_id: "", into_id: "", to_id: "", entity_type: "place", label: "", reason: "mistyped", confidence: 0.4 }, // below threshold → rejected
    { op: "add_edge", id: "", from_id: "n2", into_id: "", to_id: "n3", entity_type: "", label: "in", reason: "belongs to", confidence: 0.8 },
    { op: "drop", id: "n1", from_id: "", into_id: "", to_id: "", entity_type: "", label: "", reason: "junk", confidence: 0.7 },
  ]
  const validated = validateOps(raw, ids, 0.6, 20)
  assert(validated.length === 3, "rejects the unknown-id op and the below-threshold op, keeps the 3 valid ones")
  assert(validated.some((o) => o.op === "merge" && o.from_id === "n1" && o.into_id === "n2"), "valid merge survives")
  assert(!validated.some((o) => o.op === "retype"), "below-threshold retype is dropped")
  assert(validated.some((o) => o.op === "add_edge" && o.to_id === "n3"), "valid add_edge survives")
  assert(validated.some((o) => o.op === "drop" && o.id === "n1"), "valid drop survives")

  // cap enforcement
  const manyOps: RawGardenOp[] = Array.from({ length: 30 }, (_, i) => ({
    op: "drop", id: `n1`, from_id: "", into_id: "", to_id: "", entity_type: "", label: "", reason: `junk ${i}`, confidence: 0.9,
  }))
  assert(validateOps(manyOps, ids, 0.6, 20).length === 20, "cap enforces a hard ceiling on ops per run")

  // self-loop and unknown-op-kind rejection
  const selfLoop: RawGardenOp[] = [{ op: "merge", id: "", from_id: "n1", into_id: "n1", to_id: "", entity_type: "", label: "", reason: "x", confidence: 0.9 }]
  assert(validateOps(selfLoop, ids, 0.6, 20).length === 0, "rejects a merge targeting itself")
  const unknownKind: RawGardenOp[] = [{ op: "teleport", id: "n1", from_id: "", into_id: "", to_id: "", entity_type: "", label: "", reason: "x", confidence: 0.9 }]
  assert(validateOps(unknownKind, ids, 0.6, 20).length === 0, "silently skips an unrecognized op kind")

  // ---- orientItemUnderContainer ----
  // An item pointed at its store must be flipped so the store is the parent (source).
  const oriented = orientItemUnderContainer("item", "brand", "pasta", "aldi")
  assert(oriented.source === "aldi" && oriented.target === "pasta", "item→container is flipped to container→item")
  const already = orientItemUnderContainer("place", "item", "aldi", "pasta")
  assert(already.source === "aldi" && already.target === "pasta", "container→item is left as-is")
  const twoItems = orientItemUnderContainer("item", "item", "a", "b")
  assert(twoItems.source === "a" && twoItems.target === "b", "item↔item is not reoriented")
  const placeInPlace = orientItemUnderContainer("place", "place", "a", "b")
  assert(placeInPlace.source === "a" && placeInPlace.target === "b", "container↔container is not reoriented")

  console.log("reconcile.ts self-check OK")
}

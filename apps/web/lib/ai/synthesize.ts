import { TOPICS } from "./topics"
import { ENTITY_TYPES } from "./entityTypes"
import type { Agenda } from "./checklists"
import type { ExtractionResult, RawEntity, Attr } from "./extract"

// Dedicated extraction pass — runs separately from the chat turn so the
// conversational model never has to emit JSON. Strict structured outputs
// guarantee a schema-valid response, removing the JSON-leak/parse bug class.
//
// Model is intentionally isolated to this block. To move extraction to another
// provider later (e.g. Anthropic Sonnet for higher accuracy), swap the fetch
// call + EXTRACT_MODEL here — nothing else in the pipeline changes.
const EXTRACT_URL = "https://api.cerebras.ai/v1/chat/completions"
const EXTRACT_KEY = process.env.CEREBRAS_API_KEY!
const EXTRACT_MODEL = "gpt-oss-120b" // free tier; OpenAI-compatible strict json_schema

const INTENT_MARKERS = ["want", "need", "looking for", "thinking about getting", "planning to", "going to get"]

const attrSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Attribute name, e.g. Color, Size, Brand, Frequency" },
    value: { type: "string", description: "Concrete value stated or inferred" },
    inferred: { type: "boolean", description: "true if the value was implied rather than stated outright" },
    source_utterance: { type: "string", description: "exact phrase the inference came from (empty unless inferred)" },
  },
  // strict mode: every property listed in required. Defaults: inferred=false, source_utterance="".
  required: ["title", "value", "inferred", "source_utterance"],
} as const

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    attributes: {
      type: "array",
      description: "Concrete values stated THIS window about the entity already being tracked (the active agenda entity). Empty unless the user is answering about that exact entity.",
      items: attrSchema,
    },
    entities: {
      type: "array",
      description: "NEW things mentioned that are not already tracked — purchases, places, people, events, brands.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: 'The specific thing ("Belt", not "bought a belt")' },
          entity_type: { type: "string", enum: ENTITY_TYPES as unknown as string[] },
          tags: { type: "array", items: { type: "string", enum: TOPICS as unknown as string[] } },
          brand: { type: "string", description: "Brand name, or empty string if none/unknown" },
          intent: { type: "boolean", description: "true ONLY for a forward-looking desire to acquire/do this (want, need, looking for, planning to)" },
          intent_confidence: { type: "number" },
          intent_utterance: { type: "string", description: "exact phrase signalling intent, empty if intent is false" },
          scheduled_for: { type: "string", description: "ISO date if this is a dated event, empty otherwise" },
          description: { type: "string", description: "one-sentence summary" },
          attributes: { type: "array", items: attrSchema },
        },
        required: ["title", "entity_type", "tags", "brand", "intent", "intent_confidence", "intent_utterance", "scheduled_for", "description", "attributes"],
      },
    },
  },
  required: ["attributes", "entities"],
} as const

const SYSTEM = `You are an extraction engine for a personal knowledge graph. You read a short slice of a conversation between an interviewer (assistant) and a user, and pull out durable facts about the user. You do NOT talk to the user — you only return structured data.

## What counts as durable (extract these)
- Owned items, preferred brands, frequent places, recurring relationships, scheduled/past events
- Places and people mentioned in passing (they become threads to revisit later)
- A city revealed via "my city", "I'm from", "I live in" → a place entity, description "home city / current residence"

## What to skip
- One-off mentions with no durability ("I had a coffee") unless a frequency makes it routine
- Anything already being tracked (see "Currently tracking" below) — don't re-create it as a new entity

## entity_type — pick exactly one per entity
- item: a physical thing the user owns or wants
- brand: a brand/company itself (not a specific product)
- place: a location they go to
- person: someone in their life
- event: something that happens at a time

## title vs attributes
- title is the bare noun: "Belt", "Running shoes", "Monmouth Coffee" — NOT "black leather belt".
- Put every descriptor (color, material, size, the item's Category) in attributes, not the title. For an item, always try to capture a Category attribute (e.g. Category: belt / shoes / laptop).
- Attribute titles use Title Case and reuse standard names where they fit: Brand, Category, Color, Material, Size, Price Range, Model, Name, Location, Frequency, Relationship.
- Write a one-sentence description for every entity (don't leave it empty).

## attributes vs entities (important routing rule)
- attributes = concrete values about the entity ALREADY being tracked (the "Currently tracking" entity), stated in this window. Use this only when the user is answering about that exact entity. Otherwise [].
- entities[].attributes = values about a NEW entity introduced in this window. Never split one entity's values across both.

## inferred values
If a value is implied rather than stated ("I go there every Sunday" → Frequency: weekly), set inferred: true and source_utterance to the phrase. Otherwise inferred: false, source_utterance: "".

## intent
intent: true ONLY when the user expresses a forward-looking desire to acquire or do something (want, need, looking for, planning to, going to get). Things already owned or just mentioned are intent: false. Put the triggering phrase in intent_utterance (empty when false).

## tags
1–2 topic labels per entity, each from the allowed enum. Tags describe the entity's themes; never invent labels outside the enum.

Return only the structured JSON. Extract nothing if the slice contains no durable facts.`

function buildWindow(messages: Array<{ role: "user" | "assistant"; content: string }>): string {
  // last ~8 turns, reviewer annotations stripped, so the analyst sees the same text the LLM saw
  return messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "USER" : "INTERVIEWER"}: ${m.role === "user" ? m.content.replace(/\[.*?\]/g, "").trim() : m.content}`)
    .join("\n")
}

function agendaContext(agenda: Agenda): string {
  if (!agenda.current) return "Currently tracking: (nothing yet)"
  const known = agenda.current.attributes.map((a) => a.title).join(", ") || "none"
  return `Currently tracking: "${agenda.current.title}" (${agenda.current.entity_type}). Already have these attributes: ${known}.`
}

type ParsedEntity = {
  title: string
  entity_type: RawEntity["entity_type"]
  tags: string[]
  brand: string
  intent: boolean
  intent_confidence?: number
  intent_utterance?: string
  scheduled_for: string
  description: string
  attributes: Attr[]
}

export async function synthesize(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  agenda: Agenda
): Promise<ExtractionResult> {
  const empty: ExtractionResult = { attributes: [], entities: [] }
  if (!messages.length) return empty

  try {
    const res = await fetch(EXTRACT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${EXTRACT_KEY}` },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 3000,
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraction", strict: true, schema: SCHEMA },
        },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `${agendaContext(agenda)}\n\nConversation slice:\n${buildWindow(messages)}` },
        ],
      }),
    })

    if (!res.ok) {
      console.error("[synthesize] extraction HTTP error:", res.status, await res.text().catch(() => ""))
      return empty
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content
    if (!text) return empty
    const parsed = JSON.parse(text) as { attributes: Attr[]; entities: ParsedEntity[] }

    // Normalize "" → null and apply dual-signal intent validation (model flag AND a forward-looking marker)
    const entities: RawEntity[] = (parsed.entities ?? []).map((e) => {
      const hasMarker = INTENT_MARKERS.some((m) => (e.intent_utterance ?? "").toLowerCase().includes(m))
      const intent = e.intent && hasMarker
      return {
        title: e.title,
        topic: e.tags?.[0] ?? e.entity_type,
        brand: e.brand?.trim() ? e.brand.trim() : null,
        entity_type: e.entity_type,
        tags: e.tags ?? [],
        intent,
        intent_confidence: intent ? e.intent_confidence ?? 0 : 0,
        intent_utterance: intent ? e.intent_utterance ?? "" : "",
        scheduled_for: e.scheduled_for?.trim() ? e.scheduled_for.trim() : null,
        description: e.description ?? "",
        attributes: e.attributes ?? [],
      }
    })

    return { attributes: parsed.attributes ?? [], entities }
  } catch (err) {
    console.error("[synthesize] extraction failed:", err)
    return empty
  }
}

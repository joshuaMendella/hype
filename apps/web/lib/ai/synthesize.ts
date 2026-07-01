import { TOPICS } from "./topics"
import { ENTITY_TYPES } from "./entityTypes"
import type { Agenda } from "./checklists"
import type { ExtractionResult, RawEntity, Attr } from "./extract"

// Dedicated extraction pass — runs separately from the chat turn so the
// conversational model never has to emit JSON. Strict structured outputs
// guarantee a schema-valid response, removing the JSON-leak/parse bug class.
//
// Primary extractor: Gemini 2.5 Flash — chosen via the model shootout (scripts/
// model-shootout.ts): it reliably links item→brand and flags purchase intent,
// both of which gpt-oss-120b missed, sinking the ad/intent signal. Cerebras
// gpt-oss-120b stays as a one-call fallback if the Gemini request fails.
const GEMINI_MODEL = "gemini-2.5-flash"
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY
const CEREBRAS_MODEL = "gpt-oss-120b" // fallback; OpenAI-compatible strict json_schema

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

export const SCHEMA = {
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

export const SYSTEM = `You are an extraction engine for a personal knowledge graph. You read a short slice of a conversation between an interviewer (assistant) and a user, and pull out durable facts about the user. You do NOT talk to the user — you only return structured data.

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

## brand — link an item to the store when one is named
When the user is shopping for, looking at, or bought an item at a named store or brand in the same slice ("pants at H&M", "shoes from Nike"), set that item's brand field to that store/brand. Do NOT leave brand empty when the store is named — the item and its brand belong linked. Only leave brand empty when no store/brand is mentioned for that item.

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

export function buildWindow(messages: Array<{ role: "user" | "assistant"; content: string }>): string {
  // last ~8 turns, reviewer annotations stripped, so the analyst sees the same text the LLM saw
  return messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "USER" : "INTERVIEWER"}: ${m.role === "user" ? m.content.replace(/\[.*?\]/g, "").trim() : m.content}`)
    .join("\n")
}

export function agendaContext(agenda: Agenda): string {
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

type RawParsed = { attributes: Attr[]; entities: ParsedEntity[] }

// Gemini wants an OpenAPI-subset schema (uppercase types, no additionalProperties).
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
const GEMINI_SCHEMA = toGeminiSchema(SCHEMA)

async function extractGemini(userContent: string): Promise<RawParsed> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set")
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: GEMINI_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 }, // extraction needs no reasoning tokens
        temperature: 0, // deterministic structured extraction
        maxOutputTokens: 2048,
      },
    }),
  })
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error("gemini: empty response")
  return JSON.parse(text) as RawParsed
}

async function extractCerebras(userContent: string): Promise<RawParsed> {
  if (!CEREBRAS_KEY) throw new Error("CEREBRAS_API_KEY not set")
  const res = await fetch(CEREBRAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      max_tokens: 3000,
      response_format: { type: "json_schema", json_schema: { name: "extraction", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
    }),
  })
  if (!res.ok) throw new Error(`cerebras ${res.status}: ${await res.text().catch(() => "")}`)
  const data = await res.json()
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error("cerebras: empty response")
  return JSON.parse(text) as RawParsed
}

export async function synthesize(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  agenda: Agenda
): Promise<ExtractionResult> {
  const empty: ExtractionResult = { attributes: [], entities: [] }
  if (!messages.length) return empty

  const userContent = `${agendaContext(agenda)}\n\nConversation slice:\n${buildWindow(messages)}`

  // Gemini 2.5 Flash primary; Cerebras gpt-oss-120b one-call fallback.
  let parsed: RawParsed
  try {
    parsed = await extractGemini(userContent)
  } catch (gemErr) {
    console.error("[synthesize] Gemini extraction failed, falling back to Cerebras:", gemErr)
    try {
      parsed = await extractCerebras(userContent)
    } catch (cereErr) {
      console.error("[synthesize] extraction failed (both providers):", cereErr)
      return empty
    }
  }

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
}

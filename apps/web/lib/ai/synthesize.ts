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

// Forward-looking phrasings that confirm a purchase/acquire intent. Kept broad on purpose:
// natural speech says "looking to get" / "thinking of", not the textbook "looking for".
const INTENT_MARKERS = [
  "want", "need", "looking for", "looking to", "thinking of", "thinking about",
  "planning to", "planning on", "going to get", "gonna get", "gonna grab",
  "hoping to", "would like", "in the market", "shopping for", "pick up",
]

// A generic placeholder ("another mall", "the store", "a coffee shop") is not a real
// Name — dropping it keeps a place's tier-1 Name unmet, so the node stays incomplete and
// the interviewer circles back for the real name instead of closing on the placeholder.
const GENERIC_PLACE = "mall|store|shop|place|spot|restaurant|cafe|coffee ?shop|bar|gym|park|market|salon|barber"
const PLACEHOLDER_NAME = new RegExp(`^((the|a|an|another|some|that|this|my)\\s+)?(${GENERIC_PLACE})s?$|^(somewhere|someplace)$`, "i")
// Also used at read time (route.ts) so a node that leaked in with a placeholder title
// before this filter existed still resurfaces as unfinished instead of orphaning.
export const isPlaceholderName = (s: string) => PLACEHOLDER_NAME.test(s.trim())
function keepAttr(a: Attr): boolean {
  if (!a.value?.trim()) return false
  if (a.title?.toLowerCase() === "name" && PLACEHOLDER_NAME.test(a.value.trim())) return false
  return true
}

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
          relations: {
            type: "array",
            description: "Links from THIS entity to OTHER entities in this window that it genuinely relates to. Empty array if none.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                to: { type: "string", description: "exact title of another entity in this window" },
                label: { type: "string", description: "short verb phrase for the relationship, <=3 words: at, with, hosts, for, lives in" },
              },
              required: ["to", "label"],
            },
          },
          refines: {
            type: "string",
            description: 'Exact title of an already-tracked/in-graph entity that THIS entity is the same as, or a more specific description of (e.g. tracked "Pants" and now "blue linen pants"). "" if this is a genuinely new thing.',
          },
        },
        required: ["title", "entity_type", "tags", "brand", "intent", "intent_confidence", "intent_utterance", "scheduled_for", "description", "attributes", "relations", "refines"],
      },
    },
    // Facts about the USER themselves (not an entity). 0 / "" when not stated this window.
    user_age: { type: "number", description: "The user's own age if they state it this window, else 0" },
    user_home_location: { type: "string", description: "Where the user lives (home city/country) if stated this window, else \"\"" },
    user_current_location: { type: "string", description: "The city the user is in/living/staying in RIGHT NOW if they indicate it this window ('I'm in X', 'I'm currently in X', 'I moved to X', 'I'm staying in X', 'here in X'). Distinct from hometown/where they're from. Else \"\"." },
  },
  required: ["attributes", "entities", "user_age", "user_home_location", "user_current_location"],
} as const

export const SYSTEM = `You are an extraction engine for a personal knowledge graph. You read a short slice of a conversation between an interviewer (assistant) and a user, and pull out durable facts about the user. You do NOT talk to the user — you only return structured data.

## What counts as durable (extract these)
- Owned items, preferred brands, frequent places, recurring relationships, scheduled/past events
- Places and people mentioned in passing (they become threads to revisit later)
- A city revealed via "my city", "I'm from", "I live in" → a place entity, description "home city / current residence"

## What to skip
- One-off mentions with no durability ("I had a coffee") unless a frequency makes it routine
- Anything already being tracked (see "Currently tracking" below) — don't re-create it as a new entity
- A routine visit or trip to a place is NOT a separate event — the place itself captures it. Reserve event for dated occasions (a concert, a wedding, a planned trip), never "went to the mall / visited the shop".
- Rooms or spots where an item lives or will be used ("living room", "bedroom", "home" for a cooler) are NOT place entities — record that as the item's Location attribute. Only create a place for somewhere the user actually goes.

## entity_type — pick exactly one per entity
- item: a physical thing the user owns or wants
- brand: a brand/company itself (not a specific product)
- place: a location they go to
- person: someone in their life
- event: something that happens at a time
- org: a SPECIFIC NAMED organization the user belongs to — employer, workplace, school, team, club. Work/job/career, "my company", "where I work", "my school" map here ONLY when there is an actual organization. A skill, field, or discipline they know ("background in software development", "good with tech", "I studied biology") is NOT an org — it has no organization behind it. Route those to interest (or drop if it's just background colour).
- interest: a subject, hobby, or field the user studies, follows, or is into (financial investment, AI, photography, chess). Not a physical thing they own — that's an item. Not a company — that's a brand/org. An interest is complete the moment it's named; it can grow more specific nodes later.

## facts about the USER themselves (not entities)
The user's own age and where they live describe the person, not a thing in their life. Route these to the top-level fields, NOT to entities:
- They state their age ("I'm 28", "just turned 30") → user_age. Otherwise user_age: 0.
- They state where they live ("I live in Rzeszów", "I'm from Berlin", "my city is X") → user_home_location. Otherwise user_home_location: "".
Their occupation is different — that IS an entity (an org). Capture a job/employer/school as an org entity as usual.

## home_location vs user_current_location (two different fields — do not conflate)
- home_location = where they are FROM / their permanent home ("I'm from X", "my hometown is X", "I live in X" stated as a settled fact).
- user_current_location = where they ARE RIGHT NOW, distinct from home ("I'm in X", "I'm currently in X", "I moved to X recently", "I'm staying in X", "here in X"). Only set this when the phrasing signals present location or a recent move, not a settled home.
- If the user says only an ambiguous "I live in X" with no signal of a recent move or being elsewhere right now, keep the existing behavior: set home_location and leave user_current_location "".

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

## required attributes — always emit these (this is how the graph knows an entity is complete enough to keep)
- item → **Category** (belt, shoes, laptop). Emit **Brand** only when a store is named.
- place → **Name** when the place has a proper name (Galeria Rzeszow, Monmouth Coffee). Omit Name for a generic unnamed place ("the mall") — it stays a thread until named.
- person → **Name** (if known) and **Relationship** (friend, sister, coworker).
- event → **When** — a date or relative time ("next week", "in August"). The title says WHAT the event is; When says when.
- brand → **Category** (coffee shop, clothing store). The brand's name is the title.
- org → **Name** (the employer/school/team) and **Role** (their job title or what they do there). Title is the org's name; if the name is unknown, omit Name and it stays a thread until named.
- interest → nothing required; the title is the interest ("Financial Investment", "AI"). Add attributes only if the user gives specifics (a resource, a focus area).
Use these exact Title-Case attribute names. Never substitute (not "Timeframe" for When, not "Destination" for Where).

## refines — collapse mentions of the same thing
You are given the entities already tracked or in the graph (see "Currently tracking" and "Already tracked or in the graph"). If something mentioned this window is the SAME entity as one of those, or a more specific description of it (tracked "Pants" and now "blue linen pants"; tracked "Running shoes" and now "my Nikes"), do NOT create a new entity — set refines to that entity's EXACT title and put the new details in this entity's attributes. Only set refines to a title from that list; leave it "" for a genuinely new thing.

## relations
For each entity, connect it to OTHER entities in this window that it genuinely relates to. Each relation is { to: <exact title of another entity>, label: <verb phrase, <=3 words> }. Natural patterns:
- an event AT a place ("at"); an event WITH a person ("with")
- an item kept at or bought for a place ("for" / "kept at")
- a person who lives in a place ("lives in")
- a store/brand the user shops at, browses, or will check WHILE AT a place → relate that brand to the place ("at"). Only the place they are actually at, not one mentioned as elsewhere.
- an item the user is shopping for and the store(s) they'll look for it in → relate the item to each of those stores ("shop at")
- a place inside a larger place — a venue/mall/club in its city, a city in its country ("in"), emitted smaller→larger. A place the user visits locally (no other city named) is in their home city: relate it to the home-city place with "in".
Reuse the exact title of an entity you are also returning in this window — never invent a target that isn't one of the entities. EXCEPTION: for the "in" containment relation you MAY target a place from the "Already tracked or in the graph" list (e.g. the home city or its country) even if it isn't a fresh entity this window. Emit an empty array when nothing genuinely connects. Do not relate an entity to itself.

Return only the structured JSON. Extract nothing if the slice contains no durable facts.`

export function buildWindow(messages: Array<{ role: "user" | "assistant"; content: string }>): string {
  // last ~8 turns, reviewer annotations stripped, so the analyst sees the same text the LLM saw
  return messages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "USER" : "INTERVIEWER"}: ${m.role === "user" ? m.content.replace(/\[.*?\]/g, "").trim() : m.content}`)
    .join("\n")
}

export function buildTrackingContext(
  agenda: Agenda,
  knownNotes: Array<{ title: string; entity_type: string | null }> = []
): string {
  const lines: string[] = []
  if (agenda.current) {
    const known = agenda.current.attributes.map((a) => a.title).join(", ") || "none"
    lines.push(`Currently tracking: "${agenda.current.title}" (${agenda.current.entity_type}). Already have these attributes: ${known}.`)
  } else {
    lines.push("Currently tracking: (nothing yet)")
  }
  // Everything else already known — the model must refine these, not re-create them.
  const seen = new Set<string>(agenda.current ? [agenda.current.title.toLowerCase()] : [])
  const others: string[] = []
  for (const p of agenda.pending) {
    const k = p.title.toLowerCase()
    if (!seen.has(k)) { seen.add(k); others.push(`${p.title} (${p.entity_type})`) }
  }
  for (const n of knownNotes) {
    const k = n.title.toLowerCase()
    if (!seen.has(k)) { seen.add(k); others.push(`${n.title}${n.entity_type ? ` (${n.entity_type})` : ""}`) }
  }
  if (others.length) {
    lines.push(`Already tracked or in the graph (do NOT re-create these — set refines to the exact title if a mention refers to one): ${others.join(", ")}.`)
  }
  return lines.join("\n")
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
  relations: { to: string; label: string }[]
  refines: string
}

type RawParsed = { attributes: Attr[]; entities: ParsedEntity[]; user_age?: number; user_home_location?: string; user_current_location?: string }

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
        maxOutputTokens: 3000,
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
  agenda: Agenda,
  knownNotes: Array<{ title: string; entity_type: string | null }> = []
): Promise<ExtractionResult> {
  const empty: ExtractionResult = { attributes: [], entities: [] }
  if (!messages.length) return empty

  const userContent = `${buildTrackingContext(agenda, knownNotes)}\n\nConversation slice:\n${buildWindow(messages)}`

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
      // Drop blank-value and placeholder-Name attributes: neither may count toward tier-1
      // (that prematurely flushed an unnamed place as a duplicate/placeholder node).
      attributes: (e.attributes ?? []).filter(keepAttr),
      relations: (e.relations ?? []).filter((r) => r?.to?.trim() && r?.label?.trim()).map((r) => ({ to: r.to.trim(), label: r.label.trim() })),
      refines: e.refines?.trim() ? e.refines.trim() : undefined,
    }
  })

  // User self-facts (age/home) route to profiles.base_profile, not to the graph. 0/"" = not stated.
  const user_age = parsed.user_age && parsed.user_age > 0 ? parsed.user_age : undefined
  const user_home_location = parsed.user_home_location?.trim() ? parsed.user_home_location.trim() : undefined
  const user_current_location = parsed.user_current_location?.trim() ? parsed.user_current_location.trim() : undefined
  return { attributes: (parsed.attributes ?? []).filter(keepAttr), entities, user_age, user_home_location, user_current_location }
}

// ponytail: one runnable check — `npx tsx lib/ai/synthesize.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("synthesize.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  const agenda = {
    current: { title: "Pants", entity_type: "item", attributes: [{ title: "Category", value: "pants" }] },
    pending: [{ title: "Starbucks", entity_type: "brand" }],
  } as unknown as Agenda
  const ctx = buildTrackingContext(agenda, [{ title: "Galeria Rzeszow", entity_type: "place" }])
  assert(ctx.includes('Currently tracking: "Pants"'), "shows current entity")
  assert(ctx.includes("Starbucks (brand)"), "lists pending entities")
  assert(ctx.includes("Galeria Rzeszow (place)"), "lists known vault notes")
  assert(!ctx.split("Already tracked")[1]?.includes("Pants"), "does not duplicate current into the known list")
  // Marker gate must catch natural forward-looking phrasing, not just the textbook forms.
  assert(INTENT_MARKERS.some((m) => "i might be looking to get a new pair of pants".includes(m)), "matches 'looking to get'")
  assert(INTENT_MARKERS.some((m) => "i'm thinking of a pair of dark blue linen pants".includes(m)), "matches 'thinking of'")
  // Placeholder Name must be dropped (place stays incomplete); real names kept.
  const nameAttr = (v: string) => ({ title: "Name", value: v } as Attr)
  assert(!keepAttr(nameAttr("another mall")), "drops 'another mall'")
  assert(!keepAttr(nameAttr("the store")), "drops 'the store'")
  assert(!keepAttr(nameAttr("mall")), "drops bare 'mall'")
  assert(keepAttr(nameAttr("Galeria Rzeszow")), "keeps real name")
  assert(keepAttr(nameAttr("the Louvre")), "keeps 'the Louvre'")
  assert(keepAttr({ title: "Color", value: "the mall" } as Attr), "placeholder rule is Name-only")
  console.log("synthesize.ts self-check OK")
}

export type AgendaItem = {
  title: string
  topic: string
  path: string
  missing: string[]
}

export type Agenda = {
  current: AgendaItem | null
  pending: AgendaItem[]
}

// Required attributes per topic — what must be collected for an entity to be "complete"
// Only applies to source="conversation" nodes (items, places, events, people — not brand/topic hubs)
const REQUIRED_ATTRS: Record<string, string[]> = {
  Style:         ["Color", "Size"],
  Technology:    ["Model"],
  Food:          ["Cuisine"],
  Travel:        ["Destination"],
  Beauty:        ["Usage"],
  Relationships: ["Relationship"],
  Health:        ["Frequency"],
}

export function getMissingAttrs(topic: string, content_md: string): string[] {
  const required = REQUIRED_ATTRS[topic] ?? []
  if (!required.length) return []
  const present = new Set(
    [...(content_md ?? "").matchAll(/\*\*(.+?)\*\*:/g)].map((m) => m[1])
  )
  return required.filter((a) => !present.has(a))
}

// Human-readable checklist injected into the interviewer system prompt (static reference table)
export const CHECKLIST_PROMPT = `Attribute collection — what to gather per entity before moving on:
• Clothing / accessories (Style): Color + Size. Natural question: "What did it look like — color, any specific material? And what size?"
• Tech (Technology): Model name. "What model was it exactly?"
• Restaurant / cafe (Food): Cuisine + how often they go. "What kind of place is it, and do you go often?"
• Trip / travel (Travel): Destination + rough dates. "Where exactly, and do you have dates planned?"
• Beauty product: Brand name + how they use it.
• Person: Their relationship to the user.
• Material matters for accessories (belt, bag, jacket, wallet) — always ask: "What's it made of?"

Natural grouping rule: combine closely related attributes into one question.
✓ "What did the belt look like — color and material?"
✓ "What size did you get, and how does the fit feel?"
✗ Never ask "What color is it?" then immediately "What material is it?" as two separate turns.`

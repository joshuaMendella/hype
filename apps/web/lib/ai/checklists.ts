export type AgendaItem = {
  title: string
  topic: string
  brand: string | null
  entity_type: string
  intent: boolean
  scheduled_for: string | null
  description: string
  missing: string[]
  attributes: { title: string; value: string }[]
  turns: number
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
• Clothing / accessories (Style): Color + material + size — bundle naturally. "So how were those shoes? Like color, size, all that?" or "What did it look like — color, material, that kind of thing?"
• Tech (Technology): Model name. "What model was it? Like the exact version?"
• Restaurant / cafe (Food): Cuisine + visit frequency. "What kind of place is it — and do you go there a lot?"
• Trip / travel (Travel): Destination + rough dates. "Where exactly? And when are you thinking of going?"
• Beauty product (Beauty): Brand name + how they use it. "What brand? And how do you use it — like daily thing or more occasional?"
• Health / fitness habit (Health): Frequency. "How often do you do that?"
• Person (Relationships): Their relationship to the user. "How do you know them?"
• Material matters for accessories (belt, bag, jacket, wallet) — "What's it made of, like leather or something else?"

Natural grouping rule: bundle related attributes into one conversational question.
✓ "So how were those shoes? Color, size wise?"
✓ "What did the belt look like — color and material?"
✗ Never ask "What color is it?" then next turn "What material?" — ask them together, naturally.`

import { type EntityType, getTier1Missing } from "./entityTypes"

export type AgendaItem = {
  title: string
  topic: string
  brand: string | null
  entity_type: EntityType
  intent: boolean
  intent_utterance?: string
  intent_confidence?: number
  scheduled_for: string | null
  description: string
  missing: string[]
  attributes: { title: string; value: string; inferred?: boolean }[]
  turns: number
  weight: number
  tier1_complete: boolean
  tags: string[]
}

export type Agenda = {
  current: AgendaItem | null
  pending: AgendaItem[]
}

export function getMissingAttrs(entityType: string, content_md: string): string[] {
  return getTier1Missing(entityType as EntityType, content_md)
}

export const CHECKLIST_PROMPT = `What's worth knowing about each kind of thing — if it surfaces naturally, not a script:

The first things that make a thing real (worth a light ask if a story doesn't reveal them):
• item: what brand, and what kind of thing it is — "what brand was it? like what is it?"
• place: what it's called, roughly where, and whether they go often — "what's the spot called, and you go there a lot?"
• person: who they are and how the user knows them — "who's that — how do you know them?"
• event: what it is and roughly when — "what kind of thing? when's it happening?"
• brand: what it is and what they make — "what kind of brand is it?"

Nice to pick up when the conversation allows — never force:
• item: Color, size, price range — "So what were they like — color, size?"
• place: What for, who with — "What do you usually go there for?"
• person: Context, how long known — "How long have you known them?"
• event: Where, who with — "Where's it happening, and who are you going with?"
• brand: Sentiment — "Do you like them? Like what's your take?"

Only if it genuinely comes up — never reach for these:
• item: Material, model, where purchased
• place: Specific items, price range
• person: Age, shared interests
• event: Frequency, how they felt
• brand: Specific products

Natural grouping rule: when you do ask, bundle related details into one conversational question.
✓ "So what were those shoes like? Color, size-wise?"
✓ "What did the belt look like — like color and material?"
✗ Never ask "What color is it?" then next turn "What material?" — ask them together, naturally.`

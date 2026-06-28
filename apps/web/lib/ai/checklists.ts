import { type EntityType, getTier1Missing } from "./entityTypes"

export type AgendaItem = {
  title: string
  topic: string
  brand: string | null
  entity_type: EntityType
  intent: boolean
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

export const CHECKLIST_PROMPT = `Attribute collection — tiered priority per entity type:

Tier 1 (always capture first — these unlock vault writes):
• item: Brand + Category — "What brand was it? Like what kind of item?"
• place: Name + Location + how often they go — "What's the place called, where is it, and do you go there a lot?"
• person: Name + how they know them — "Who are they — like how do you know them?"
• event: What it is + rough timing — "What kind of event? When is it?"
• brand: Name + category — "What kind of brand is it?"

Tier 2 (collect naturally when the conversation allows — don't force):
• item: Color, size, price range — "So what were they like — color, size?"
• place: What for, who with — "What do you usually go there for?"
• person: Context, how long known — "How long have you known them?"
• event: Where, who with — "Where's it happening, and who are you going with?"
• brand: Sentiment — "Do you like them? Like what's your take?"

Tier 3 (nice to have — only if it comes up naturally):
• item: Material, model, where purchased
• place: Specific items, price range
• person: Age, shared interests
• event: Frequency, how they felt
• brand: Specific products

Natural grouping rule: bundle related tier 1 or tier 2 attrs into one conversational question.
✓ "So what were those shoes like? Color, size-wise?"
✓ "What did the belt look like — like color and material?"
✗ Never ask "What color is it?" then next turn "What material?" — ask them together, naturally.`

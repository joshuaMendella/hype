export const ENTITY_TYPES = ["item", "brand", "place", "person", "event"] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const TIER_PARAMS: Record<EntityType, { tier1: string[]; tier2: string[]; tier3: string[] }> = {
  item:   { tier1: ["Brand", "Category"],              tier2: ["Color", "Size", "Price Range"],  tier3: ["Material", "Model", "Where Purchased"] },
  place:  { tier1: ["Name", "Location", "Frequency"],  tier2: ["What For", "Who With"],          tier3: ["Specific Items", "Price Range"] },
  person: { tier1: ["Name", "Relationship"],            tier2: ["Context", "How Long Known"],     tier3: ["Age", "Shared Interests"] },
  event:  { tier1: ["What", "When"],                   tier2: ["Where", "Who With"],             tier3: ["Frequency", "How They Felt"] },
  brand:  { tier1: ["Name", "Category"],               tier2: ["Sentiment"],                     tier3: ["Specific Products"] },
}

export function getTier1Missing(entityType: EntityType, content_md: string): string[] {
  const tier1 = TIER_PARAMS[entityType]?.tier1 ?? []
  const present = new Set([...(content_md ?? "").matchAll(/\*\*(.+?)\*\*:/g)].map((m) => m[1]))
  return tier1.filter((a) => !present.has(a))
}

export const ENTITY_TYPES = ["item", "brand", "place", "person", "event", "org"] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const TIER_PARAMS: Record<EntityType, { tier1: string[]; tier2: string[]; tier3: string[] }> = {
  item:   { tier1: ["Category"],             tier2: ["Brand", "Color", "Size", "Price Range"], tier3: ["Material", "Model", "Where Purchased"] },
  place:  { tier1: ["Name"],                 tier2: ["Location", "Frequency", "What For", "Who With"], tier3: ["Specific Items", "Price Range"] },
  person: { tier1: ["Name", "Relationship"], tier2: ["Context", "How Long Known"], tier3: ["Age", "Shared Interests"] },
  event:  { tier1: ["When"],                 tier2: ["Where", "Who With"], tier3: ["Frequency", "How They Felt"] },
  brand:  { tier1: ["Category"],             tier2: ["Sentiment"], tier3: ["Specific Products"] },
  // org: an organization the user belongs to — employer, school, team, club. Name = its name, Role = what they do there.
  org:    { tier1: ["Name", "Role"],         tier2: ["Category", "Field", "How Long"], tier3: ["Team Size", "Sentiment"] },
}

export function getTier1Missing(entityType: EntityType, content_md: string): string[] {
  const tier1 = TIER_PARAMS[entityType]?.tier1 ?? []
  // Case-insensitive: extracted attribute titles may be lowercase ("category") while tier names are Title Case ("Category").
  const present = new Set([...(content_md ?? "").matchAll(/\*\*(.+?)\*\*:/g)].map((m) => m[1].toLowerCase()))
  return tier1.filter((a) => !present.has(a.toLowerCase()))
}

// ponytail: one runnable check — `npx tsx lib/ai/entityTypes.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("entityTypes.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  assert(getTier1Missing("item", "- **Category**: pants").length === 0, "item completes on Category alone")
  assert(getTier1Missing("item", "- **Color**: blue").length === 1, "item without Category is incomplete")
  assert(getTier1Missing("event", "- **When**: next week").length === 0, "event completes on When")
  assert(getTier1Missing("brand", "- **Category**: coffee shop").length === 0, "brand completes on Category")
  assert(getTier1Missing("place", "- **Name**: Galeria Rzeszow").length === 0, "named place completes on Name")
  assert(getTier1Missing("place", "- **Frequency**: weekly").length === 1, "unnamed place is incomplete")
  assert(getTier1Missing("org", "- **Name**: Acme\n- **Role**: engineer").length === 0, "org completes on Name+Role")
  assert(getTier1Missing("org", "- **Name**: Acme").length === 1, "org without Role is incomplete")
  console.log("entityTypes.ts self-check OK")
}

// Pure resolver for relationship edges. Kept dependency-free (no server imports) so it's
// trivially testable and reusable. Maps two entity titles to note ids via a case-insensitive
// title→id map; returns null when either end is missing or both ends are the same node.
export function resolveRelation(
  idByTitle: Map<string, string>,
  sourceTitle: string,
  targetTitle: string
): { source: string; target: string } | null {
  const source = idByTitle.get(sourceTitle.trim().toLowerCase())
  const target = idByTitle.get(targetTitle.trim().toLowerCase())
  if (!source || !target || source === target) return null
  return { source, target }
}

// ponytail: one runnable check — `npx tsx lib/ai/relations.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("relations.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  const map = new Map([["mall", "id-mall"], ["giessen", "id-g"]])
  assert(JSON.stringify(resolveRelation(map, "Mall", "Giessen")) === JSON.stringify({ source: "id-mall", target: "id-g" }), "resolves both ends case-insensitively")
  assert(resolveRelation(map, "Mall", "Nowhere") === null, "unresolved target → null")
  assert(resolveRelation(map, "Ghost", "Giessen") === null, "unresolved source → null")
  assert(resolveRelation(map, "Mall", "mall") === null, "self-link → null")
  console.log("relations.ts self-check OK")
}

import type { GraphNode, GraphLink } from "./types"

// Size scales with connections — hubs are big, leaves are small
export function nodeRadius(degree: number): number {
  return Math.max(4, Math.min(20, 4 + Math.sqrt(degree + 1) * 4))
}

// Degree map for node sizing
export function buildDegreeMap(links: GraphLink[]): Record<string, number> {
  const degreeMap: Record<string, number> = {}
  links.forEach((l) => {
    const src = typeof l.source === "string" ? l.source : (l.source as GraphNode).id
    const tgt = typeof l.target === "string" ? l.target : (l.target as GraphNode).id
    degreeMap[src] = (degreeMap[src] ?? 0) + 1
    degreeMap[tgt] = (degreeMap[tgt] ?? 0) + 1
  })
  return degreeMap
}

// Verbatim from web GraphCanvas — the "You"-node synthesis; keep in sync via this shared copy.
export function synthesizeSelfLinks(nodes: GraphNode[], links: GraphLink[]): GraphLink[] {
  const selfLinks: GraphLink[] = []

  // Connect "You" to the graph: the home screen should read as a portrait of the self,
  // not a floating dot. Synthesize (client-side, never persisted) an edge from the
  // _profile.md root to every top-level entity — i.e. nodes that don't already hang off
  // a brand. Items under a brand stay nested; everything else links straight to You.
  const profile = nodes.find((n) => n.path === "_profile.md")
  if (profile) {
    const targetId = (l: GraphLink) => (typeof l.target === "string" ? l.target : (l.target as GraphNode).id)
    const sourceId = (l: GraphLink) => (typeof l.source === "string" ? l.source : (l.source as GraphNode).id)
    const structuralLinks = links.filter((l) => l.link_type === "brand" || l.link_type === "relation" || l.link_type === "located_in")
    // located_in points contained→container, so its SOURCE is the child (opposite of brand/relation).
    const childId = (l: GraphLink) => (l.link_type === "located_in" ? sourceId(l) : targetId(l))
    const children = new Set(structuralLinks.map(childId))

    // You links to every ROOT (no incoming brand/relation edge); children nest under their parent.
    // But a pure cycle (e.g. event--"at"-->place + place--"hosts"-->event) has NO root, so the
    // root-only rule alone would leave its whole component floating free of You — the exact
    // "floating dot" this feature exists to prevent. Union-find the brand/relation graph and
    // anchor any rootless component to You with a single self edge.
    const parent = new Map<string, string>()
    for (const n of nodes) if (n.id !== profile.id) parent.set(n.id, n.id)
    const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r }
    for (const l of structuralLinks) {
      const s = sourceId(l), t = targetId(l)
      if (parent.has(s) && parent.has(t)) parent.set(find(s), find(t))
    }
    const rootedComponents = new Set<string>()
    for (const n of nodes) if (n.id !== profile.id && !children.has(n.id)) rootedComponents.add(find(n.id))

    const anchoredRootless = new Set<string>()
    for (const n of nodes) {
      if (n.id === profile.id) continue
      const comp = find(n.id)
      const isRoot = !children.has(n.id)
      const anchorRootless = !isRoot && !rootedComponents.has(comp) && !anchoredRootless.has(comp)
      if (anchorRootless) anchoredRootless.add(comp)
      if (isRoot || anchorRootless) {
        selfLinks.push({ id: `self-${n.id}`, source: profile.id, target: n.id, anchor_text: null, link_type: "self" })
      }
    }
  }

  return selfLinks
}

export function withSelfLinks(nodes: GraphNode[], links: GraphLink[]): GraphLink[] {
  return [...links, ...synthesizeSelfLinks(nodes, links)]
}

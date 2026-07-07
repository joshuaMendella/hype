import assert from "node:assert"
import type { GraphNode, GraphLink } from "./types"
import { synthesizeSelfLinks } from "./graph-layout"

function makeNode(id: string, path = `${id}.md`): GraphNode {
  return {
    id,
    title: id,
    topic: null,
    path,
    intent: false,
    wordCount: 1,
    source: "conversation",
    entity_type: "item",
    attributes: [],
  }
}

// Case 1: profile + two top-level entities with no incoming brand/relation edges.
// Both are roots -> expect exactly 2 self links, one per root, source === profile.id.
{
  const profile = makeNode("profile", "_profile.md")
  const e1 = makeNode("e1")
  const e2 = makeNode("e2")
  const nodes: GraphNode[] = [profile, e1, e2]
  const links: GraphLink[] = []
  const originalLength = links.length

  const selfLinks = synthesizeSelfLinks(nodes, links)

  assert.strictEqual(selfLinks.length, 2, "expected 2 self links for two top-level roots")
  for (const l of selfLinks) {
    assert.strictEqual(l.source, profile.id, "self link source must be the profile node")
    assert.strictEqual(l.link_type, "self", "synthesized link must be type self")
  }
  assert.strictEqual(links.length, originalLength, "input links array must not be mutated")
}

// Case 2: pure cycle, no root. A --relation--> B and B --relation--> A.
// Both nodes have incoming relation edges, so neither is a root. The union-find
// must still anchor this rootless component to the profile with exactly ONE self link.
{
  const profile = makeNode("profile", "_profile.md")
  const a = makeNode("a")
  const b = makeNode("b")
  const nodes: GraphNode[] = [profile, a, b]
  const links: GraphLink[] = [
    { id: "l1", source: a.id, target: b.id, anchor_text: "at", link_type: "relation" },
    { id: "l2", source: b.id, target: a.id, anchor_text: "hosts", link_type: "relation" },
  ]
  const originalLength = links.length

  const selfLinks = synthesizeSelfLinks(nodes, links)

  assert.strictEqual(selfLinks.length, 1, "expected exactly 1 self link anchoring the rootless cycle")
  assert.strictEqual(selfLinks[0].source, profile.id, "self link source must be the profile node")
  assert.strictEqual(selfLinks[0].link_type, "self", "synthesized link must be type self")
  assert.strictEqual(links.length, originalLength, "input links array must not be mutated")
}

console.log("graph-layout self-check passed")

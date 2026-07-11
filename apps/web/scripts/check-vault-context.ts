import assert from "node:assert"
import { buildVaultContext, type VaultContextNote } from "../lib/ai/vaultContext"

const note = (i: number, over: Partial<VaultContextNote> = {}): VaultContextNote => ({
  title: `Note ${i}`,
  topic: "Food & Drink",
  content_md: `content ${i}`,
  entity_type: "place",
  ...over,
})
const emptyAgenda = { current: null, pending: [] }

// 1) small vault: everything in full, no index section
{
  const out = buildVaultContext([note(1), note(2)], emptyAgenda)
  assert(out.includes("### [Food & Drink] Note 1\ncontent 1"), "full block missing")
  assert(!out.includes("Everything else"), "index should not appear under 20 notes")
}

// 2) >20 notes: first 20 full, the rest indexed as title lines
{
  const notes = Array.from({ length: 25 }, (_, i) => note(i))
  const out = buildVaultContext(notes, emptyAgenda)
  assert(out.includes("Everything else in their vault"), "index section missing")
  assert(out.includes("- Note 24 (place) [Food & Drink]"), "index line missing")
  assert(!out.includes("### [Food & Drink] Note 24"), "note 24 must not be a full block")
}

// 3) agenda relevance pulls a late note into the full window
{
  const notes = Array.from({ length: 25 }, (_, i) => note(i))
  const out = buildVaultContext(notes, { current: { title: "Note 24", tags: [] }, pending: [] })
  assert(out.includes("### [Food & Drink] Note 24\ncontent 24"), "agenda note not promoted to full")
}

// 4) content-less notes land in the index, never as full blocks
{
  const notes = [...Array.from({ length: 20 }, (_, i) => note(i)), note(99, { content_md: null })]
  const out = buildVaultContext(notes, emptyAgenda)
  assert(out.includes("- Note 99 (place) [Food & Drink]"), "content-less note missing from index")
  assert(!out.includes("### [Food & Drink] Note 99"), "content-less note must not be a full block")
}

console.log("vault-context checks passed")

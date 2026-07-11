// Interviewer vault context: full content for the K most relevant notes, a compact
// titles-only index for everything else. Full-vault visibility is what makes recall
// work past the first 20 notes (traction review 2026-07-11, finding #3).

export type VaultContextNote = {
  title: string
  topic: string | null
  content_md: string | null
  entity_type: string | null
}

export type AgendaLike = {
  current: { title: string; tags?: string[] } | null
  pending: Array<{ title: string }>
}

export const FULL_CONTENT_COUNT = 20

// Notes arrive most-recently-updated first; the relevance sort is stable, so ties keep
// recency order — identical top-20 behavior to the pre-index implementation.
export function buildVaultContext(notes: VaultContextNote[], agenda: AgendaLike): string {
  const currentTitle = agenda.current?.title?.toLowerCase()
  const currentTags = new Set((agenda.current?.tags ?? []).map((t) => t.toLowerCase()))
  const pendingTitles = new Set(agenda.pending.map((p) => p.title.toLowerCase()))
  const relevance = (n: VaultContextNote) => {
    const t = n.title.toLowerCase()
    if (currentTitle && t === currentTitle) return 3
    if (pendingTitles.has(t)) return 2
    if (n.topic && currentTags.has(n.topic.toLowerCase())) return 1
    return 0
  }

  const withContent = notes.filter((n) => n.content_md?.trim())
  const ordered = [...withContent].sort((a, b) => relevance(b) - relevance(a))
  const full = ordered.slice(0, FULL_CONTENT_COUNT)
  const fullSet = new Set(full)
  // The index covers every note not shown in full — including content-less ones;
  // knowing a node exists is exactly what recall needs. Excluded by object identity,
  // not title: vault_notes titles aren't unique, and a title match would drop a
  // duplicate-titled note from both sections.
  const indexed = notes.filter((n) => !fullSet.has(n))

  const fullBlock = full
    .map((n) => `### ${n.topic ? `[${n.topic}] ` : ""}${n.title}\n${n.content_md}`)
    .join("\n\n")
  if (!indexed.length) return fullBlock

  const indexBlock = indexed
    .map((n) => `- ${n.title}${n.entity_type ? ` (${n.entity_type})` : ""}${n.topic ? ` [${n.topic}]` : ""}`)
    .join("\n")
  const indexSection = `#### Everything else in their vault (titles only — you remember these exist; recall or weave them in when relevant, never re-ask them):\n${indexBlock}`
  return fullBlock ? `${fullBlock}\n\n${indexSection}` : indexSection
}

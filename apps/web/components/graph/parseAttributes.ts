// Vault notes store attributes as markdown bullets ("- **Brand**: H&M").
// The graph shows them on node hover rather than as separate nodes.
export function parseAttributes(md: string | null | undefined): { label: string; value: string }[] {
  if (!md) return []
  const out: { label: string; value: string }[] = []
  const re = /^-\s*\*\*(.+?)\*\*:\s*(.+?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(md))) out.push({ label: m[1], value: m[2] })
  return out
}

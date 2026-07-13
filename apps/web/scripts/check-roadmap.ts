// Sanity check for the roadmap data file. Run: pnpm dlx tsx scripts/check-roadmap.ts
import { ROADMAP } from "../lib/admin/roadmap"

let failed = false
const fail = (msg: string) => { console.error(`FAIL: ${msg}`); failed = true }

if (ROADMAP.length === 0) fail("ROADMAP is empty")
const names = new Set<string>()
for (const area of ROADMAP) {
  if (!area.name.trim()) fail("area with empty name")
  if (names.has(area.name)) fail(`duplicate area name: ${area.name}`)
  names.add(area.name)
  if (area.principle.trim().length < 40) fail(`${area.name}: principle missing or too thin`)
  if (area.items.length === 0) fail(`${area.name}: no items`)
  for (const item of area.items) {
    if (!item.title.trim()) fail(`${area.name}: item with empty title`)
  }
}

if (failed) process.exit(1)
console.log(`OK: ${ROADMAP.length} areas, ${ROADMAP.reduce((n, a) => n + a.items.length, 0)} items`)

/** Confirm the two extraction fixes: no redundant `event` for a routine visit,
 *  and no `place` entities for an item's placement rooms. */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Agenda } from "../lib/ai/checklists"

for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

const empty: Agenda = { current: null, pending: [] }

async function main() {
  const { synthesize } = await import("../lib/ai/synthesize")

  // A — mall visit should NOT spawn a separate `event` node
  const mall = await synthesize([
    { role: "user", content: "yesterday i spent some time at the shopping mall" },
    { role: "assistant", content: "which mall was it? find anything?" },
    { role: "user", content: "it's called Galeria Rzeszow, i found a nice pair of pants at H&M" },
  ], empty)
  const events = mall.entities.filter((e) => e.entity_type === "event")
  console.log("A) mall visit entities:", mall.entities.map((e) => `${e.title}[${e.entity_type}]`).join(", "))
  console.log("   events (should be 0):", events.length, events.length === 0 ? "✅" : "❌")

  // B — the cooler's placement rooms should be an attribute, not place entities
  const cooler = await synthesize([
    { role: "user", content: "i need to get a new air cooler for my home, it's too hot" },
    { role: "assistant", content: "any preferences on size or where it'll go?" },
    { role: "user", content: "something small, for my living room or bedroom" },
  ], { current: { title: "Air cooler", topic: "Home", brand: null, entity_type: "item", intent: true, scheduled_for: null, description: "wants an air cooler", missing: [], attributes: [], turns: 1, weight: 2, tier1_complete: false, tags: ["Home"] }, pending: [] })
  const rooms = cooler.entities.filter((e) => /living room|bedroom|home/i.test(e.title))
  const coolerAttrs = [...(cooler.attributes ?? []), ...cooler.entities.flatMap((e) => e.attributes ?? [])]
  console.log("\nB) cooler entities:", cooler.entities.map((e) => `${e.title}[${e.entity_type}]`).join(", ") || "(none — attrs on current)")
  console.log("   room place-entities (should be 0):", rooms.length, rooms.length === 0 ? "✅" : "❌")
  console.log("   Location attribute present:", coolerAttrs.some((a) => a.title === "Location") ? "✅" : "⚠️ (model may phrase differently)")
}
main().catch((e) => { console.error(e); process.exit(1) })

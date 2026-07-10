// Golden-transcript smoke test for extraction quality. Runs real conversation slices
// through synthesize() and asserts the model emits the required vocabulary and collapses
// refinements. It calls the live model (temperature 0) — a smoke test, not a hard gate.
// Run from apps/web:  npx tsx scripts/extract-eval.ts
import { readFileSync } from "fs"
import { resolve } from "path"
import type { Agenda } from "../lib/ai/checklists"

// Load .env.local without a dependency (must happen before synthesize is imported,
// because synthesize captures process.env at module load time).
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

let failed = 0
const assert = (c: boolean, m: string) => { console.log(`${c ? "ok  " : "FAIL"}: ${m}`); if (!c) failed++ }
const hasAttr = (attrs: { title: string }[], name: string) =>
  attrs.some((a) => a.title.toLowerCase() === name.toLowerCase())

async function main() {
  // Dynamic import AFTER env is loaded so synthesize.ts sees the API keys.
  const { synthesize } = await import("../lib/ai/synthesize")

  // 1. Item → Category emitted (belt bought, no store).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "What did you pick up?" }, { role: "user", content: "I bought a belt today" }],
      { current: null, pending: [] } as Agenda
    )
    const belt = ext.entities.find((e) => e.entity_type === "item")
    assert(!!belt && hasAttr(belt.attributes ?? [], "Category"), "item 'belt' carries a Category attribute")
  }

  // 2. Event → When emitted (not Timeframe/Destination).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "Anything coming up?" }, { role: "user", content: "I'm going to a concert next week" }],
      { current: null, pending: [] } as Agenda
    )
    const evt = ext.entities.find((e) => e.entity_type === "event")
    assert(!!evt && (hasAttr(evt.attributes ?? [], "When") || !!evt.scheduled_for), "event carries When (or scheduled_for)")
  }

  // 3. Refinement collapses: tracking "Pants", user adds material → no new bare item,
  //    or a refines pointer back to Pants.
  {
    const agenda = {
      current: { title: "Pants", entity_type: "item", attributes: [{ title: "Category", value: "pants" }], brand: null, intent: false, intent_utterance: "", intent_confidence: 0, scheduled_for: null, description: "", missing: [], turns: 1, weight: 2, tier1_complete: true, tags: ["Shopping"] },
      pending: [],
    } as unknown as Agenda
    const ext = await synthesize(
      [{ role: "assistant", content: "Nice — what are they like?" }, { role: "user", content: "They're blue and made of linen" }],
      agenda,
      [{ title: "Pants", entity_type: "item" }]
    )
    // The refinement's details (blue/linen) must be captured SOMEWHERE — either the top-level
    // attributes drill bucket (current-entity update) or a refines->Pants entity. Both are valid
    // dedup; the only wrong outcome is a NEW UNLINKED item. Asserting capture first prevents a
    // false green when the model returns zero entities.
    const capturedInBucket = hasAttr(ext.attributes, "Color") || hasAttr(ext.attributes, "Material")
    const pantsRefinement = ext.entities.find(
      (e) => e.entity_type === "item" && (e.refines ?? "").toLowerCase() === "pants"
    )
    const capturedInRefinement = !!pantsRefinement &&
      (hasAttr(pantsRefinement.attributes ?? [], "Color") || hasAttr(pantsRefinement.attributes ?? [], "Material"))
    const newBarePants = ext.entities.filter(
      (e) => e.entity_type === "item" && (e.refines ?? "").toLowerCase() !== "pants"
    )
    assert(capturedInBucket || capturedInRefinement, "refinement details (Color/Material) are captured, not lost")
    assert(newBarePants.length === 0, "refinement of tracked 'Pants' does not spawn a new unlinked item")
  }

  // 4. Relative-date travel → event with ISO scheduled_for (workstream B, docs/graph/2026-07-10).
  {
    const ext = await synthesize(
      [{ role: "assistant", content: "Anything coming up?" }, { role: "user", content: "I'm heading back home to Rzeszów on Sunday" }],
      { current: null, pending: [] } as Agenda
    )
    const evt = ext.entities.find((e) => e.entity_type === "event")
    assert(!!evt, "travel/return statement yields an event entity")
    assert(!!evt?.scheduled_for && /^\d{4}-\d{2}-\d{2}$/.test(evt.scheduled_for), "return-home event carries an ISO scheduled_for")
    const todayISO = new Date().toISOString().split("T")[0]
    assert(!!evt?.scheduled_for && evt.scheduled_for >= todayISO, "resolved 'Sunday' is not in the past")
  }

  console.log(failed === 0 ? "\nextract-eval: ALL OK" : `\nextract-eval: ${failed} FAILED`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })

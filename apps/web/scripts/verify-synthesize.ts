/** Verify the live synthesize() now runs on Gemini and links pants→H&M + intent. */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Agenda } from "../lib/ai/checklists"

// load env BEFORE importing synthesize (it captures process.env at module load)
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

const messages = [
  { role: "user" as const, content: "I had a coffee at starbucks and checked a few shops" },
  { role: "assistant" as const, content: "Nice coffee break—what shops did you check out at the mall?" },
  { role: "user" as const, content: "I went to H&M to look for a pair of pants" },
  { role: "assistant" as const, content: "what style of pants were you after, like the cut, color, or size?" },
  { role: "user" as const, content: "i'm looking for a pair of dark linen pants" },
  { role: "assistant" as const, content: "any particular size?" },
  { role: "user" as const, content: "probably in large size" },
]
const agenda: Agenda = { current: null, pending: [] }

async function main() {
  const { synthesize } = await import("../lib/ai/synthesize")
  const out = await synthesize(messages, agenda)
  console.log(JSON.stringify(out, null, 2))
  const pants = out.entities.find((e) => /pant/i.test(e.title))
  console.log("\nCHECK — pants entity:", pants?.title, "| brand:", pants?.brand, "| intent:", pants?.intent, "| utterance:", pants?.intent_utterance)
  console.log("VERDICT:", pants && pants.brand === "H&M" && pants.intent ? "✅ brand-linked + intent captured" : "❌ still broken")
}
main().catch((e) => { console.error(e); process.exit(1) })

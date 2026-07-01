/**
 * Model shootout — current model (Cerebras gpt-oss-120b) vs Gemini 2.5 Flash.
 *
 * Replays the real session-12 mall/pants transcript through both models on
 * IDENTICAL inputs and reports:
 *   1. CHAT/PERSONA — both replies side by side for every user turn, so you can
 *      judge tone, transitions, memory, and the one-question metronome.
 *   2. EXTRACTION  — the structured JSON each model pulls from the same window
 *      + agenda, with pass/fail checks on the intent signal and entities.
 *   3. COST        — real Gemini token usage summed across the run, priced out.
 *
 * The chat SYSTEM_PROMPT is read LIVE from app/api/chat/route.ts (no drift).
 * The extraction SYSTEM + SCHEMA are imported from lib/ai/synthesize.ts.
 *
 * Run:  cd apps/web && npx tsx scripts/model-shootout.ts
 * Needs in apps/web/.env.local:  CEREBRAS_API_KEY=...  GEMINI_API_KEY=...
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  SYSTEM as EXTRACT_SYSTEM,
  SCHEMA as EXTRACT_SCHEMA,
  buildWindow,
  agendaContext,
} from "../lib/ai/synthesize"
import { CHECKLIST_PROMPT, type Agenda } from "../lib/ai/checklists"

// ─── env ────────────────────────────────────────────────────────────────────
function loadEnv() {
  const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}
loadEnv()
const CEREBRAS_KEY = process.env.CEREBRAS_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!CEREBRAS_KEY) throw new Error("CEREBRAS_API_KEY missing from apps/web/.env.local")
if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY missing from apps/web/.env.local — get one free at https://aistudio.google.com/apikey")

const GEMINI_MODEL = "gemini-2.5-flash"
const CEREBRAS_MODEL = "gpt-oss-120b"

// free tiers cap per-minute — pace calls and retry on 429
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const DELAY = Number(process.env.DELAY_MS ?? 6500)
async function rlFetch(url: string, opts: any, tries = 3): Promise<Response> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, opts)
    if (res.status !== 429) return res
    console.error(`  …429, waiting 25s (retry ${i + 1}/${tries})`)
    await sleep(25000)
  }
  return fetch(url, opts)
}

// running token tally for the real cost readout (Gemini)
let gemInTok = 0
let gemOutTok = 0

// ─── the real transcript (session 12, conversation aae44e1d) ─────────────────
type Msg = { role: "user" | "assistant"; content: string }
const strip = (s: string) => s.replace(/\[.*?\]/g, "").trim()

const TRANSCRIPT: Msg[] = [
  { role: "user", content: "Hi, today not much, day just started. But yesterday i went to cut my hair and then to the shopping mall" },
  { role: "assistant", content: "Nice, fresh cut—how was the experience?" },
  { role: "user", content: "it was great, the guy was very good" },
  { role: "assistant", content: "Cool, what's the barbershop called?" },
  { role: "user", content: "I'm not sure, but it's located near where i live" },
  { role: "assistant", content: "Got it—what part of town is it around?" },
  { role: "user", content: "near Galeria Rzeszow, in the city of Rzeszow" },
  { role: "assistant", content: "Cool spot—do you happen to know the shop’s name?" },
  { role: "user", content: "[you already asked me this and i said i didn't remember] no" },
  { role: "assistant", content: "Sounds like a handy spot. What did you end up getting at the mall?" },
  { role: "user", content: "[hard transition, need bridge between topics, something softer and natural] I had a coffee at starbucks and checked a few shops" },
  { role: "assistant", content: "Nice coffee break—what shops did you check out at the mall?" },
  { role: "user", content: "I went to H&M to look for a pair of pants" },
  { role: "assistant", content: "Sounds like a solid hunt—what style of pants were you after at H&M, like the cut, color, or size?" },
  { role: "user", content: "i'm looking for a pair of dark linen plants" },
  { role: "assistant", content: "Got it—any particular size you’re looking for for those dark linen pants?" },
  { role: "user", content: "probably in large size" },
  { role: "assistant", content: "Got it—do you usually get your hair cut there often?" },
  { role: "user", content: "[hard transition, we went back to the hairdresser while we were talking about shops] It was the first time" },
  { role: "assistant", content: "First time’s always interesting—do you think you’ll go back there for another haircut?" },
]

// the flagged turns (user-message indices) where the reviewer left notes
const FLAGGED = new Set([8, 10, 18])

// agenda state at the end of the conversation (current = Shopping Mall)
const AGENDA: Agenda = {
  current: {
    title: "Shopping Mall",
    topic: "Location",
    brand: null,
    entity_type: "place",
    intent: false,
    scheduled_for: null,
    description: "User went to a shopping mall after getting a haircut yesterday.",
    missing: ["Name", "Frequency"],
    attributes: [{ title: "Location", value: "near Galeria Rzeszow, Rzeszow" }],
    turns: 4,
    weight: 9,
    tier1_complete: false,
    tags: ["Location"],
  },
  pending: [],
}

// ─── chat system prompt, read live from route.ts ─────────────────────────────
function chatSystemPrompt(): string {
  const routeTxt = readFileSync(resolve(process.cwd(), "app/api/chat/route.ts"), "utf8")
  const m = routeTxt.match(/const SYSTEM_PROMPT = `([\s\S]*?)`\r?\n\r?\nconst ONBOARDING_PROMPT/)
  if (!m) throw new Error("Could not extract SYSTEM_PROMPT from route.ts")
  const persona = m[1].replace("${CHECKLIST_PROMPT}", CHECKLIST_PROMPT)
  // representative context tail (identical for both models — fairness)
  const context = [
    "## What you already know about this person:",
    "(nothing captured yet — early session)",
    "",
    "## On your mind right now (a gentle thread, not a checklist):",
    "You were just talking about **Shopping Mall** (place). If it comes up naturally, Name and Frequency would be nice to know — but only if the moment's right.",
  ].join("\n")
  return `${persona}\n\n${context}`
}

// ─── providers: chat ─────────────────────────────────────────────────────────
async function cerebrasChat(system: string, history: Msg[]): Promise<string> {
  const res = await rlFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      max_tokens: 400,
      messages: [{ role: "system", content: system }, ...history],
    }),
  })
  const d = await res.json()
  if (!res.ok) return `(cerebras error ${res.status}: ${JSON.stringify(d).slice(0, 120)})`
  const msg = d.choices?.[0]?.message ?? {}
  return (msg.content || msg.reasoning || "(empty)").trim()
}

async function geminiChat(system: string, history: Msg[]): Promise<string> {
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  const res = await rlFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 200, temperature: 0.8, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  )
  const d = await res.json()
  if (!res.ok) return `(gemini error ${res.status}: ${JSON.stringify(d).slice(0, 160)})`
  const u = d.usageMetadata
  if (u) { gemInTok += u.promptTokenCount ?? 0; gemOutTok += u.candidatesTokenCount ?? 0 }
  const parts = d.candidates?.[0]?.content?.parts
  return (parts?.[0]?.text ?? `(no text — ${JSON.stringify(d.candidates?.[0] ?? d).slice(0, 160)})`).trim()
}

// ─── providers: extraction ───────────────────────────────────────────────────
async function cerebrasExtract(system: string, user: string): Promise<any> {
  const res = await rlFetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${CEREBRAS_KEY}` },
    body: JSON.stringify({
      model: CEREBRAS_MODEL,
      max_tokens: 3000,
      response_format: { type: "json_schema", json_schema: { name: "extraction", strict: true, schema: EXTRACT_SCHEMA } },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  })
  const d = await res.json()
  if (!res.ok) return { _error: `${res.status}: ${JSON.stringify(d).slice(0, 200)}` }
  try { return JSON.parse(d.choices?.[0]?.message?.content ?? "{}") } catch (e) { return { _error: String(e) } }
}

// JSON-Schema → Gemini responseSchema (OpenAPI subset)
function toGemini(s: any): any {
  if (s.type === "object") {
    return {
      type: "OBJECT",
      properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)])),
      required: s.required,
      ...(s.description ? { description: s.description } : {}),
    }
  }
  if (s.type === "array") return { type: "ARRAY", items: toGemini(s.items), ...(s.description ? { description: s.description } : {}) }
  const o: any = { type: String(s.type).toUpperCase() }
  if (s.enum) o.enum = s.enum
  if (s.description) o.description = s.description
  return o
}

async function geminiExtract(system: string, user: string): Promise<any> {
  const res = await rlFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGemini(EXTRACT_SCHEMA),
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )
  const d = await res.json()
  if (!res.ok) return { _error: `${res.status}: ${JSON.stringify(d).slice(0, 200)}` }
  const u = d.usageMetadata
  if (u) { gemInTok += u.promptTokenCount ?? 0; gemOutTok += u.candidatesTokenCount ?? 0 }
  try { return JSON.parse(d.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") } catch (e) { return { _error: String(e) } }
}

// ─── report helpers ──────────────────────────────────────────────────────────
const INTENT_MARKERS = ["want", "need", "looking for", "thinking about getting", "planning to", "going to get"]
const line = "─".repeat(78)

function summarizeExtraction(label: string, out: any) {
  console.log(`\n  ── ${label} ──`)
  if (out._error) { console.log(`  ERROR: ${out._error}`); return }
  const ents: any[] = out.entities ?? []
  console.log(`  entities: ${ents.length} | top-level attributes: ${(out.attributes ?? []).length}`)
  for (const e of ents) {
    const dual = e.intent && INTENT_MARKERS.some((m) => (e.intent_utterance ?? "").toLowerCase().includes(m))
    console.log(
      `   • ${e.title} [${e.entity_type}]${e.brand ? ` brand=${e.brand}` : ""}` +
      ` intent(model)=${e.intent}${e.intent ? ` "${e.intent_utterance}"` : ""} → dual-signal=${dual}` +
      (e.attributes?.length ? `\n       attrs: ${e.attributes.map((a: any) => `${a.title}=${a.value}`).join(", ")}` : "")
    )
  }
  // scorecard
  const titles = ents.map((e) => e.title.toLowerCase())
  const pants = ents.find((e) => /pant/.test(e.title.toLowerCase()))
  const pantsIntent = pants && pants.intent && INTENT_MARKERS.some((m) => (pants.intent_utterance ?? "").toLowerCase().includes(m))
  console.log(`  ✔ checks: pants-intent=${pantsIntent ? "YES ✅" : "NO ❌"} | ` +
    `has-Starbucks=${titles.some((t: string) => t.includes("starbuck"))} | ` +
    `has-H&M=${titles.some((t: string) => t.includes("h&m") || t.includes("h & m"))} | ` +
    `mall-named=${titles.some((t: string) => t.includes("galeria"))}`)
}

// ─── run ─────────────────────────────────────────────────────────────────────
async function main() {
  const chatSys = chatSystemPrompt()

  console.log(line)
  console.log("PART 1 — CHAT / PERSONA  (identical system prompt + history for both models)")
  console.log(line)

  for (let j = 0; j < TRANSCRIPT.length; j++) {
    if (TRANSCRIPT[j].role !== "user") continue
    const history: Msg[] = TRANSCRIPT.slice(0, j + 1).map((m) =>
      m.role === "user" ? { role: "user", content: strip(m.content) } : m
    )
    const actual = TRANSCRIPT[j + 1]?.content ?? "(none)"
    const cere = await cerebrasChat(chatSys, history); await sleep(DELAY)
    const gem = await geminiChat(chatSys, history); await sleep(DELAY)

    console.log(`\n${FLAGGED.has(j) ? "★ FLAGGED " : ""}Turn — USER: ${strip(TRANSCRIPT[j].content)}`)
    console.log(`  [orig transcript] ${actual}`)
    console.log(`  [gpt-oss-120b   ] ${cere}`)
    console.log(`  [gemini-2.5-flash] ${gem}`)
  }

  console.log(`\n${line}`)
  console.log("PART 2 — EXTRACTION  (same window + agenda, real synthesize prompt/schema)")
  console.log(line)
  const user = `${agendaContext(AGENDA)}\n\nConversation slice:\n${buildWindow(TRANSCRIPT)}`
  const cereX = await cerebrasExtract(EXTRACT_SYSTEM, user); await sleep(DELAY)
  const gemX = await geminiExtract(EXTRACT_SYSTEM, user)
  summarizeExtraction("gpt-oss-120b", cereX)
  summarizeExtraction("gemini-2.5-flash", gemX)

  console.log(`\n${line}`)
  console.log("PART 3 — REAL GEMINI COST (this run)")
  console.log(line)
  const inCost = (gemInTok / 1e6) * 0.15
  const outCost = (gemOutTok / 1e6) * 0.6
  console.log(`  gemini tokens: ${gemInTok} in / ${gemOutTok} out`)
  console.log(`  cost @ $0.15/$0.60 per 1M: $${(inCost + outCost).toFixed(5)} for this whole ${TRANSCRIPT.length / 2}-turn replay`)
  console.log(`  → ~$${(((inCost + outCost) / (TRANSCRIPT.length / 2))).toFixed(5)} per turn (chat+extraction sampled)\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })

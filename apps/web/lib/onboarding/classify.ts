// apps/web/lib/onboarding/classify.ts
// Server-only. One tiny structured Gemini call turning a freeform onboarding answer into a
// clean graph node {title, entity_type, confidence}. Falls back to the regex heuristics in
// titles.ts if the call fails or the key is absent. Schema-constrained + temperature 0 —
// same risk profile as lib/ai/synthesize.ts, NOT the deleted conversational onboarding path.
import { ENTITY_TYPES } from "@/lib/ai/entityTypes"
import { stripLeadIn, workNodeTitle } from "./titles"

const GEMINI_MODEL = "gemini-2.5-flash"
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export type SeedKind = "location" | "work"
export interface SeedClassification { title: string; entity_type: string; confidence: number }

const LOCATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "The bare city/town name only, e.g. 'Giessen' — no lead-in words, no sentence." },
    confidence: { type: "NUMBER", description: "0..1 — how clearly the answer names a real place." },
  },
  required: ["title", "confidence"],
}

const WORK_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "The specific NAMED thing that fills their week — an employer, school, degree, or personal project (e.g. 'THM', 'biology', 'freelance design'). The bare noun, not a sentence." },
    entity_type: { type: "STRING", enum: ["org", "interest"], description: "org = a named employer/school/team. interest = a field/discipline/hobby with no organization behind it." },
    confidence: { type: "NUMBER", description: "0..1 — low if the answer is vague/category-shaped ('a bit of both', 'work', 'stuff') with nothing concrete named." },
  },
  required: ["title", "entity_type", "confidence"],
}

const LOCATION_SYS = "You clean a user's answer to 'what city is home right now?' into a single place name for a knowledge-graph node. Return the bare city/town name as the user would write it, nothing else."
const WORK_SYS = "You turn a user's answer to 'what does your week mostly go to?' into one knowledge-graph node. Pull the specific named thing (employer, school, degree, project) as the title and classify it as an org (a named organization) or an interest (a field/discipline with no organization). If the answer is vague or category-shaped with nothing concrete, set confidence low."

async function callGemini(sys: string, schema: object, answer: string): Promise<SeedClassification | null> {
  if (!GEMINI_KEY) return null
  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: answer }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0,
          maxOutputTokens: 200,
        },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text)
    const title = String(parsed.title ?? "").trim()
    if (!title) return null
    return {
      title: title.slice(0, 60),
      entity_type: parsed.entity_type ?? "place",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    }
  } catch {
    return null
  }
}

export async function classifySeed(kind: SeedKind, answer: string): Promise<SeedClassification> {
  if (kind === "location") {
    const c = await callGemini(LOCATION_SYS, LOCATION_SCHEMA, answer)
    if (c) return { ...c, entity_type: "place" } // a home city is always a place
    const title = stripLeadIn(answer).slice(0, 60) || answer.trim().slice(0, 60)
    return { title, entity_type: "place", confidence: title ? 0.6 : 0 }
  }
  // work
  const c = await callGemini(WORK_SYS, WORK_SCHEMA, answer)
  if (c) {
    const et = (ENTITY_TYPES as readonly string[]).includes(c.entity_type) ? c.entity_type : "org"
    return { ...c, entity_type: et }
  }
  return { title: workNodeTitle(answer), entity_type: "org", confidence: 0.4 }
}

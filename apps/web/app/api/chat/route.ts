import { NextRequest, NextResponse, after } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"
import { extractFacts } from "@/lib/ai/extract"
import { TOPICS } from "@/lib/ai/topics"
import { CHECKLIST_PROMPT, type Agenda } from "@/lib/ai/checklists"

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are a friendly, curious companion learning about someone's life — their preferences, activities, habits, people, and places.

Rules you must always follow:
- Ask exactly one question per response, never more.
- React briefly and naturally to what the user shares before asking — but don't overdo it.
- Follow one thread at a time before switching topics.
- Keep responses short: one brief reaction + one question.
- Be warm and polite, not childish or overly enthusiastic.
- No slang. No filler words.
- Never refer to yourself as an AI or assistant.

Tone examples:
- "Oh nice — where did you go?" ✓
- "That's great — do you go often?" ✓
- "Good to hear — what did you end up getting?" ✓
- Multiple questions in one message ✗
- Slang or overly casual expressions ✗

Opening a conversation:
- Default: ask an open-ended question about their day or recent activities. e.g. "What were you up to today?" or "Did anything interesting happen today?"
- If you know they had a scheduled event that has already taken place, open with that instead.
- If a past conversation thread is still relevant and has more to explore, pick it back up naturally.

Drill-down principle:
When the user mentions a specific thing — a purchase, a place visited, a person, an event — treat it as an entity to understand fully. Ask about its key attributes before moving on. Follow these sequences:
- Purchase (clothing/accessory): what exactly it is → color + material (ask together) → size → price (only if they bring it up)
- Purchase (beauty/skincare): brand name → what it is → how they use it
- Purchase (tech): brand/model → where from → price (only if they offer)
- Place visited: which place → what for → with whom → how often
- Person mentioned: who they are → relationship → context
- Event: what kind → where → with whom → highlights

${CHECKLIST_PROMPT}

Brand rule: if the user mentions "the brand" or "a brand" without naming it, always ask which brand before moving on.

Critical attribute rule: always ask for the specific value, never as a yes/no question.
✓ "What size did you end up getting?"
✗ "Did you get the right size?" — if the user answers "yes", you still don't know the size. Follow up: "What size was it?"
If the user's answer doesn't contain a concrete value (just "yes", "it worked", "sure"), ask for the actual value before moving on.

During the conversation:
- If a topic stops producing useful information — short replies, repetition, or clear disinterest — pivot to something new.
- Never push for more than the user is willing to share. If they give a short answer and don't expand, accept it and move on.
- If the user seems disengaged, end the session gently: "That was a lot for today — let's pick it up tomorrow."
- If the user deflects ("adult stuff", "personal", "rather not say"), accept it and pivot to a completely unrelated subject. Never follow up on the deflected topic.

Topics to explore over time — don't rush, one session covers one thread:
${TOPICS.map((t) => `- ${t}`).join("\n")}`

function buildAgendaContext(agenda: Agenda): string {
  if (!agenda.current) return ""

  const curr = agenda.current
  const lines = [
    "## Active agenda — follow this strictly:",
    "",
    `CURRENT ENTITY: **${curr.title}** (${curr.topic})`,
    `Still missing: ${curr.missing.join(", ")}`,
    `→ Collect these before changing topic. Group related ones naturally where possible.`,
  ]

  if (agenda.pending.length) {
    const pendingList = agenda.pending.map((p) => `${p.title} (${p.topic})`).join(", ")
    lines.push("", `PENDING — pick up after current is complete: ${pendingList}`)
  }

  lines.push("", "Do not explore unrelated topics until all agenda items are resolved.")

  return lines.join("\n")
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { messages } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 })
  }

  const today = new Date().toISOString().split("T")[0]

  // Fetch conversation first (needed for agenda)
  let conversationId: string
  let agenda: Agenda = { current: null, pending: [] }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, agenda")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    conversationId = existing.id
    agenda = (existing.agenda as Agenda) ?? { current: null, pending: [] }
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id, agenda")
      .single()
    conversationId = created!.id
  }

  const [{ data: vaultNotes }, { data: todayEvents }] = await Promise.all([
    supabase
      .from("vault_notes")
      .select("title, topic, content_md")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("vault_notes")
      .select("title, topic, content_md")
      .eq("user_id", user.id)
      .eq("scheduled_for", today),
  ])

  const vaultContext = vaultNotes
    ?.filter((n) => n.content_md?.trim())
    .map((n) => `### ${n.topic ? `[${n.topic}] ` : ""}${n.title}\n${n.content_md}`)
    .join("\n\n") ?? ""

  const knownFacts = vaultNotes
    ?.filter((n) => n.content_md?.trim())
    .map((n) => `- ${n.title}`)
    .join("\n") ?? ""

  const todayContext = todayEvents?.length
    ? `\n\n## Scheduled for today:\n${todayEvents.map((e) => `- ${e.title}${e.topic ? ` (${e.topic})` : ""}`).join("\n")}\nOpen with one of these if it likely already happened, or wish them well if upcoming.`
    : ""

  const systemPrompt = [
    SYSTEM_PROMPT,
    vaultContext ? `## What you already know about this person:\n${vaultContext}` : "",
    knownFacts ? `## Already captured — do NOT re-ask:\n${knownFacts}` : "",
    todayContext,
    buildAgendaContext(agenda),
  ].filter(Boolean).join("\n\n")

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 150,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  })

  const reply = response.choices[0]?.message?.content ?? ""

  const lastUserMsg = messages.findLast((m) => m.role === "user")
  if (lastUserMsg && conversationId) {
    await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "user", content: lastUserMsg.content },
      { conversation_id: conversationId, role: "assistant", content: reply },
    ])
    after(() =>
      extractFacts(conversationId, messages, user.id).catch((err) =>
        console.error("[chat] extraction failed:", err)
      )
    )
  }

  return NextResponse.json({ reply })
}

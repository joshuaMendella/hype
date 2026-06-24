import { NextRequest, NextResponse } from "next/server"
import Groq from "groq-sdk"
import { createClient } from "@/lib/supabase/server"

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

Start conversations with a broad open question about their day or recent activities, then drill down naturally on whatever they share.

Topics to explore over time — don't rush, one session covers one thread:
- Daily activities and routines
- Food, restaurants, cooking
- Shopping habits and preferences
- Exercise and health
- Work and projects
- People in their life
- Hobbies and interests
- Goals and plans`

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

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 150,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  })

  const reply = response.choices[0]?.message?.content ?? ""

  // Store the last user message and AI reply in Supabase
  // Find or create active conversation
  let conversationId: string

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (existing) {
    conversationId = existing.id
  } else {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select("id")
      .single()
    conversationId = created!.id
  }

  const lastUserMsg = messages.findLast((m) => m.role === "user")
  if (lastUserMsg && conversationId) {
    await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "user", content: lastUserMsg.content },
      { conversation_id: conversationId, role: "assistant", content: reply },
    ])
  }

  return NextResponse.json({ reply })
}

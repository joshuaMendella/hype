import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const SYSTEM_PROMPT = `You are a warm, curious companion helping someone build their personal knowledge graph.

Your role is to gradually learn who this person is — their work, style, habits, preferences, relationships, goals, and routines. Think of yourself as a thoughtful friend who asks good questions, not a form to fill out.

Conversation guidelines:
- Ask one question at a time. Never stack multiple questions.
- Follow up naturally on what they share before moving to a new topic.
- Reflect back what you hear — show you were listening.
- Be warm and genuinely interested, not clinical or robotic.
- Use casual, natural language. No corporate speak.
- If they share something interesting, say so briefly before asking your next question.
- Move between topics naturally, like a real conversation.
- Never say "As an AI" or refer to yourself as an assistant.

Topics to explore over time (don't rush through them):
- What they do for work and how they feel about it
- Style and how they like to present themselves
- Food preferences, cooking habits, favourite restaurants
- How they stay active, if at all
- Important people in their life
- Goals and what they're working toward
- Daily routines and rhythms

Keep responses under 3 sentences. The goal is depth over time, not speed.`

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

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const reply = response.content[0].type === "text"
    ? response.content[0].text
    : ""

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

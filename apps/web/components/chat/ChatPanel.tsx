"use client"

import { useState, useRef, useEffect } from "react"
import type { Message } from "@/types/database"

interface Props {
  userId: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export default function ChatPanel({ userId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Kick off with the AI's opening message
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "Hey! I'm here to get to know you a little. What's something you've been really into lately — could be anything.",
    }])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const next: ChatMessage[] = [...messages, { role: "user", content: text }]
    setMessages(next)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, userId }),
      })

      if (!res.ok) throw new Error("Chat request failed")

      const { reply } = await res.json()
      setMessages((prev) => [...prev, { role: "assistant", content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong on my end. Mind trying again?" },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-40
        flex flex-col
        bg-[#111111]/95 backdrop-blur-md
        border border-white/8 rounded-2xl
        shadow-2xl shadow-black/60
        transition-all duration-300 ease-in-out
        ${open ? "w-[360px] h-[480px]" : "w-[180px] h-[44px]"}
      `}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-white/80">Hype AI</span>
        </div>
        <span className="text-white/30 text-xs">{open ? "–" : "+"}</span>
      </div>

      {open && (
        <>
          {/* Divider */}
          <div className="h-px bg-white/5 mx-4" />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-none">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`
                    max-w-[85%] text-sm leading-relaxed px-3 py-2 rounded-xl
                    ${msg.role === "user"
                      ? "bg-white text-black rounded-br-sm"
                      : "bg-white/8 text-white/85 rounded-bl-sm"
                    }
                  `}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 px-3 py-2 rounded-xl rounded-bl-sm">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 120}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 mx-4" />

          {/* Input */}
          <div className="px-4 py-3 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type something…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 resize-none focus:outline-none leading-relaxed max-h-24 overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="text-white/40 hover:text-white/90 disabled:opacity-20 transition-colors pb-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.5 1.5l13 6.5-13 6.5v-5l9-1.5-9-1.5v-5z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

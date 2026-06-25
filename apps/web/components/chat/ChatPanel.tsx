"use client"

import { useState, useRef, useEffect, useCallback } from "react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

function opening(name: string | null) {
  const greeting = name ? `Hey ${name[0].toUpperCase() + name.slice(1)}` : "Hey"
  return `${greeting} — what have you been up to today?`
}

// ponytail: word-by-word reveal via recursive setTimeout, no animation lib
function useTypewriter(text: string, speed = 52) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    const words = text.split(" ")
    let i = 0
    let timer: ReturnType<typeof setTimeout>

    function tick() {
      i++
      setDisplayed(words.slice(0, i).join(" "))
      if (i < words.length) timer = setTimeout(tick, speed)
      else setDone(true)
    }

    timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [text, speed])

  return { displayed, done }
}

export default function ChatPanel({ userId, userName }: { userId: string; userName: string | null }) {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [currentAi, setCurrentAi] = useState(() => opening(userName))
  const [aiVisible, setAiVisible] = useState(true)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [canInput, setCanInput] = useState(false)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { displayed, done } = useTypewriter(currentAi)

  useEffect(() => {
    if (done) {
      setCanInput(true)
      inputRef.current?.focus()
    }
  }, [done])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !canInput) return

    setCanInput(false)
    setInput("")
    setLoading(true)
    setAiVisible(false)

    const next: ChatMessage[] = [
      ...history,
      { role: "assistant", content: currentAi },
      { role: "user", content: text },
    ]
    setHistory(next)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, userId }),
      })
      if (!res.ok) throw new Error()
      const { reply } = await res.json()
      setCurrentAi(reply)
    } catch {
      setCurrentAi("Something slipped on my end — want to try that again?")
    } finally {
      setLoading(false)
      setAiVisible(true)
    }
  }, [input, loading, canInput, history, currentAi, userId])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      send()
    }
  }

  const borderColor = focused
    ? "rgba(255,255,255,0.55)"
    : canInput
    ? "rgba(255,255,255,0.22)"
    : "transparent"

  return (
    <div className="fixed inset-0 z-30 flex flex-col pointer-events-none select-none">
      {/* ── AI voice — top center ─────────────────────────────────────── */}
      <div
        className="pointer-events-none flex justify-center"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 62%, transparent 100%)",
          paddingTop: "clamp(2.75rem, 5.5vw, 4.5rem)",
          paddingBottom: "4.5rem",
          paddingLeft: "clamp(1.5rem, 7vw, 9rem)",
          paddingRight: "clamp(1.5rem, 7vw, 9rem)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-poppins), sans-serif",
            fontSize: "clamp(1.3rem, 2.6vw, 1.85rem)",
            fontWeight: 300,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.87)",
            textAlign: "center",
            maxWidth: "680px",
            minHeight: "3.5rem",
            opacity: aiVisible ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        >
          {displayed}
          {!done && (
            <span
              className="inline-block align-middle animate-pulse"
              style={{
                width: "2px",
                height: "1em",
                background: "#A78BFA",
                marginLeft: "4px",
                borderRadius: "1px",
              }}
            />
          )}
        </p>
      </div>

      {/* ── Graph shows through here ──────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── User input — bottom center ────────────────────────────────── */}
      <div
        className="pointer-events-auto flex justify-center"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.38) 62%, transparent 100%)",
          paddingBottom: "clamp(2.25rem, 4.5vw, 3.75rem)",
          paddingTop: "4.5rem",
          paddingLeft: "clamp(1.5rem, 7vw, 9rem)",
          paddingRight: "clamp(1.5rem, 7vw, 9rem)",
        }}
      >
        <div style={{ maxWidth: "540px", width: "100%" }}>
          {/* Thinking dots while AI is responding */}
          {loading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "8px",
                paddingBottom: "14px",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="animate-bounce"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "rgba(167,139,250,0.55)",
                    display: "inline-block",
                    animationDelay: `${i * 0.12}s`,
                    animationDuration: "0.85s",
                  }}
                />
              ))}
            </div>
          )}

          {/* Input line */}
          {!loading && (
            <div style={{ position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                disabled={!canInput}
                placeholder={canInput ? "your answer…" : ""}
                autoComplete="off"
                spellCheck={false}
                className="select-auto"
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: `1px solid ${borderColor}`,
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "1.08rem",
                  lineHeight: 1.5,
                  padding: "10px 36px 10px 0",
                  outline: "none",
                  caretColor: "#A78BFA",
                  transition: "border-color 0.25s ease, opacity 0.2s ease",
                  fontFamily: "inherit",
                  opacity: canInput ? 1 : 0,
                }}
              />
              {canInput && input.trim() && (
                <button
                  onClick={send}
                  style={{
                    position: "absolute",
                    right: 0,
                    bottom: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.32)",
                    padding: 0,
                    lineHeight: 1,
                    transition: "color 0.18s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "rgba(255,255,255,0.72)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "rgba(255,255,255,0.32)")
                  }
                >
                  <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 1.5l13 6.5-13 6.5v-5l9-1.5-9-1.5v-5z" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Hint — only while idle and input empty */}
          {canInput && !loading && !input && (
            <p
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.16)",
                fontSize: "0.68rem",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                marginTop: "10px",
              }}
            >
              enter to reply
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

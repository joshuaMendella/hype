"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import AdCardView, { type AdCard } from "./AdCard"
import ExampleConsentCard from "./ExampleConsentCard"
import { onboardingCopy, onboardingPlaceholder } from "@/lib/onboarding/script"
import { completeOnboarding } from "@/lib/onboarding/seed"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

// ponytail: word-by-word reveal via recursive setTimeout, no animation lib
function useTypewriter(text: string, speed = 85) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(false); return }
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

type ObStep = "welcome" | "howto" | "consent" | "location" | "work" | "confirm" | "interview"

export default function ChatPanel({ userId, userName, initialHistory = [], onReply, onboarded = true, onLocationSeeded }: { userId: string; userName: string | null; initialHistory?: ChatMessage[]; onReply?: () => void; onboarded?: boolean; onLocationSeeded?: (city: string) => void }) {
  // Restore an active (<2h) conversation on reload: seed prior turns so the model keeps context,
  // and show the last AI line where we left off. One message at a time — no scrollback. Messages
  // are always saved user→assistant pairs, so the last is the AI's line: split it out as currentAi.
  const lastMsg = initialHistory[initialHistory.length - 1]
  const seedAi = lastMsg?.role === "assistant" ? lastMsg.content : ""
  const seeded = seedAi !== ""
  const seedHistory = seeded ? initialHistory.slice(0, -1) : initialHistory
  // Onboarding runs only for a brand-new user with no restored conversation. Beats 1–6 are
  // client-side (no /api/chat); beat 7 is the live interviewer after the flag flips.
  const startInOnboarding = !onboarded && !seeded

  const [history, setHistory] = useState<ChatMessage[]>(seedHistory)
  const [currentAi, setCurrentAi] = useState(seedAi)
  const [card, setCard] = useState<AdCard | null>(null)
  const [aiVisible, setAiVisible] = useState(seeded)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(!seeded)
  const [canInput, setCanInput] = useState(false)
  const [focused, setFocused] = useState(false)
  // Current message arrived via stream → bypass the typewriter (text is already incremental).
  const [streamMode, setStreamMode] = useState(false)
  const [streamDone, setStreamDone] = useState(true)
  const [obStep, setObStep] = useState<ObStep>(startInOnboarding ? "welcome" : "interview")
  const histAfterWorkRef = useRef<ChatMessage[]>([])
  const handoffRef = useRef(false)
  const [showConsentCard, setShowConsentCard] = useState(false)
  const [showConsentTrailing, setShowConsentTrailing] = useState(false)
  const workRetriedRef = useRef(false)
  const onboarding = obStep !== "interview"
  const inputRef = useRef<HTMLInputElement>(null)
  const { displayed, done } = useTypewriter(streamMode ? "" : currentAi)
  const shownText = streamMode ? currentAi : displayed
  const shownDone = streamMode ? streamDone : done

  useEffect(() => {
    if (seeded) return // restored an active conversation — show where we left off, no opener fetch
    if (startInOnboarding) {
      // Beat 1 — no network. currentAi is the first scripted line; typewriter → canInput.
      setCurrentAi(onboardingCopy.welcome(userName ?? "there"))
      setAiVisible(true)
      setLoading(false)
      return
    }
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], userId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ reply, card: openerCard }) => { setCurrentAi(reply); setCard(openerCard ?? null); setAiVisible(true) })
      .catch(() => { setCurrentAi("Hey — what have you been up to today?"); setAiVisible(true) })
      .finally(() => setLoading(false))
  }, [userId, seeded, startInOnboarding, userName])

  useEffect(() => {
    if (done && obStep !== "consent") setCanInput(true)
  }, [done, obStep])

  // Consent beat: reveal the example card after the line finishes printing (+400ms), then
  // the trailing "you say yes or no" line (+1.2s), which is what unlocks input. Card is the
  // payoff of "…like this:" — it must arrive as a reveal, never alongside the text.
  useEffect(() => {
    if (obStep !== "consent") { setShowConsentCard(false); setShowConsentTrailing(false); return }
    if (!shownDone) return
    const t1 = setTimeout(() => setShowConsentCard(true), 400)
    const t2 = setTimeout(() => setShowConsentTrailing(true), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [obStep, shownDone])

  useEffect(() => {
    if (showConsentTrailing) setCanInput(true)
  }, [showConsentTrailing])

  useEffect(() => {
    if (canInput) inputRef.current?.focus()
  }, [canInput])

  // Advance the scripted onboarding one beat per user reply. Beats 1–3 ignore the reply
  // text (any ack advances); beats 4–5 seed a graph node from it; then confirm + handoff.
  const sendOnboarding = useCallback(async (text: string) => {
    setCanInput(false)
    setInput("")
    setAiVisible(false)

    // Keep the transcript so the interviewer has context at handoff.
    const withTurn = (): ChatMessage[] => [
      ...history,
      { role: "assistant", content: currentAi },
      { role: "user", content: text },
    ]

    if (obStep === "welcome") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.howto); setObStep("howto"); setAiVisible(true); return
    }
    if (obStep === "howto") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.consentIntro); setObStep("consent"); setAiVisible(true); return
    }
    if (obStep === "consent") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.askLocation); setObStep("location"); setAiVisible(true); return
    }
    if (obStep === "location") {
      const next = withTurn()
      setHistory(next)
      setLoading(true)
      let cityTitle = text.trim()
      try {
        const r = await fetch("/api/onboarding/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "location", answer: text }),
        })
        const d = await r.json().catch(() => ({}))
        if (d?.title) cityTitle = d.title
      } catch { /* seeding failed — still advance with the raw answer */ }
      onLocationSeeded?.(cityTitle) // place links to You only if its title is in identityPlaces
      onReply?.() // refresh so the Place node pops
      setLoading(false)
      setCurrentAi(onboardingCopy.askWork(cityTitle)); setObStep("work"); setAiVisible(true); return
    }
    if (obStep === "work") {
      const next = withTurn()
      setHistory(next)
      setLoading(true)
      const force = workRetriedRef.current
      let low = false
      try {
        const r = await fetch("/api/onboarding/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "work", answer: text, force }),
        })
        const d = await r.json().catch(() => ({}))
        low = d?.lowConfidence === true
      } catch { /* seeding failed — treat as committed, don't stall */ }
      setLoading(false)
      // Vague first answer → one in-voice clarifier, stay on the work beat (nothing seeded yet).
      if (low && !force) {
        workRetriedRef.current = true
        setCurrentAi(onboardingCopy.workRetry); setAiVisible(true); return
      }
      histAfterWorkRef.current = next // handoff replays this to the interviewer for beat 7
      onReply?.() // node written → refresh so the Org/Interest node pops
      setCurrentAi(onboardingCopy.confirm); setObStep("confirm"); setAiVisible(true); return
    }
  }, [obStep, history, currentAi, userId, onReply, onLocationSeeded])

  // After the confirm beat is read, flip the flag and let the real interviewer produce
  // beat 7 from the seeded facts. Runs once. completeOnboarding MUST precede the fetch so
  // the route takes the interview path, never the (now-deleted) onboarding path.
  useEffect(() => {
    if (obStep !== "confirm" || !done || handoffRef.current) return
    handoffRef.current = true
    const t = setTimeout(async () => {
      setAiVisible(false)
      setLoading(true)
      try {
        await completeOnboarding(userId)
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: histAfterWorkRef.current, userId }),
        })
        const { reply } = res.ok ? await res.json() : { reply: "So — what's your day been like?" }
        setHistory(histAfterWorkRef.current)
        setCurrentAi(reply ?? "So — what's your day been like?")
      } catch {
        setHistory(histAfterWorkRef.current)
        setCurrentAi("So — what's your day been like?")
      } finally {
        setObStep("interview")
        setLoading(false)
        setAiVisible(true)
      }
    }, 900) // let the graph animation + confirm line land before the interviewer speaks
    return () => clearTimeout(t)
  }, [obStep, done, userId])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !canInput) return

    setCanInput(false)
    setInput("")
    setLoading(true)
    setAiVisible(false)
    setCard(null)

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
        body: JSON.stringify({ messages: next, userId, stream: true }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStreamMode(false)
        setCurrentAi(body.error === "rate_limit"
          ? "I've hit my daily message limit — check back in a bit."
          : "Something slipped on my end — want to try that again?")
        return
      }
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/x-ndjson") && res.body) {
        // Real stream: append chunks as they arrive; typewriter stays out of the way.
        setStreamMode(true)
        setCurrentAi("")
        setStreamDone(false)
        setLoading(false)
        setAiVisible(true)
        let acc = ""
        let errored = false
        const handleLine = (line: string) => {
          if (!line.trim()) return
          try {
            const evt = JSON.parse(line)
            if (evt.t) { acc += evt.t; setCurrentAi(acc) }
            if (evt.error) errored = true
          } catch { /* torn line — skip */ }
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ""
        for (;;) {
          const { done: rdDone, value } = await reader.read()
          if (rdDone) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          lines.forEach(handleLine)
        }
        handleLine(buf)
        // A mid-stream error means the server persisted nothing — don't present the
        // partial text as a completed reply the DB will never have.
        if (errored || !acc) setCurrentAi("Something slipped on my end — want to try that again?")
        setStreamDone(true)
        setCanInput(true)
        onReply?.()
      } else {
        // JSON path — onboarding, cards, or stream fallback. Typewriter as before.
        const { reply, card: newCard } = await res.json()
        setStreamMode(false)
        setCurrentAi(reply)
        setCard(newCard ?? null)
        onReply?.()
      }
    } catch {
      // network failure / bad JSON — surface it instead of an unhandled rejection + silent stall
      setStreamMode(false)
      setCurrentAi("Something slipped on my end — want to try that again?")
    } finally {
      setLoading(false)
      setAiVisible(true)
    }
  }, [input, loading, canInput, history, currentAi, userId])

  const submit = useCallback(() => {
    const text = input.trim()
    if (!text || loading || !canInput) return
    if (onboarding) { void sendOnboarding(text); return }
    void send()
  }, [input, loading, canInput, onboarding, sendOnboarding, send])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    }
  }

  const borderColor = focused
    ? "rgba(255,255,255,0.55)"
    : canInput
    ? "rgba(255,255,255,0.22)"
    : "transparent"

  const inputPlaceholder = onboarding
    ? (onboardingPlaceholder[obStep] ?? "")
    : "your answer… [notes in brackets]"

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
            fontSize: currentAi.length > 200 ? "clamp(0.95rem, 1.7vw, 1.15rem)" : currentAi.length > 100 ? "clamp(1.1rem, 2.1vw, 1.45rem)" : "clamp(1.3rem, 2.6vw, 1.85rem)",
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
          {shownText}
          {!shownDone && (
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

      {/* ── Graph shows through here / ad card sits mid-screen ─────────── */}
      <div className="flex-1 flex items-center justify-center">
        {obStep === "consent" ? (
          showConsentCard && (
            <div className="pointer-events-none flex flex-col items-center gap-4">
              <ExampleConsentCard ask={onboardingCopy.exampleAsk} />
              <p
                style={{
                  fontFamily: "var(--font-poppins), sans-serif",
                  fontSize: "clamp(0.95rem, 1.7vw, 1.1rem)",
                  fontWeight: 300,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  maxWidth: "360px",
                  opacity: showConsentTrailing ? 1 : 0,
                  transition: "opacity 0.5s ease",
                }}
              >
                {onboardingCopy.consentTrailing}
              </p>
            </div>
          )
        ) : (
          card && (
            <div className="pointer-events-auto">
              <AdCardView card={card} />
            </div>
          )
        )}
      </div>

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
                placeholder={canInput ? inputPlaceholder : ""}
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
                  onClick={submit}
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

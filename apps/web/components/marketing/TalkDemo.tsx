"use client"

import { useEffect, useRef, useState } from "react"

// §2 "No forms. Just talk.": the chat IS the scene here. The graph-growing spectacle
// belongs to §3, so this stays a warm, human back-and-forth — one natural conversation that
// wanders across topics, with a typing beat before each reply and a soft fade on loop reset.
// Each landed line buds a small you-spectrum node onto the row below — "a fact lands, a node
// buds off" — the same accumulation the real graph does, in miniature.

const SPECTRUM = ["#4ADE80", "#60A5FA", "#A78BFA", "#F472B6"]

const CHAT: { who: "ai" | "you"; text: string }[] = [
  { who: "ai", text: "What did you get up to this weekend?" },
  { who: "you", text: "Long run Saturday, then coffee with Sarah." },
  { who: "ai", text: "Nice — still training for that marathon?" },
  { who: "you", text: "Yeah. Been picking the guitar back up too." },
  { who: "ai", text: "Love that. Which one — the acoustic you mentioned?" },
]

export default function TalkDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(-1)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let timers: ReturnType<typeof setTimeout>[] = []
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        if (reduce) return setStep(CHAT.length)
        // Reveal one line at a time; hold, fade out, reset, replay — stays alive, never static.
        const play = () => {
          setFading(false)
          timers = CHAT.map((_, i) => setTimeout(() => setStep(i), 500 + i * 1300))
          const end = 500 + CHAT.length * 1300
          timers.push(setTimeout(() => setFading(true), end + 3000))
          timers.push(setTimeout(() => setStep(-1), end + 3700))
          timers.push(setTimeout(play, end + 3900))
        }
        play()
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [])

  // A typing beat shows while the assistant "thinks" — i.e. the last revealed line was yours
  // and the next one is the AI's, not yet arrived.
  const typing = step >= 0 && CHAT[step]?.who === "you" && CHAT[step + 1]?.who === "ai"

  return (
    <div
      ref={ref}
      className="mx-auto max-w-lg transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className="space-y-3">
        {CHAT.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.who === "you" ? "justify-end" : "justify-start"} transition-all duration-500`}
            style={{ opacity: step >= i ? 1 : 0, transform: step >= i ? "none" : "translateY(10px)" }}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-5 py-3 text-[1.0625rem] leading-relaxed ${
                m.who === "you"
                  ? "bg-you-blue text-void shadow-[0_0_30px_-10px_rgba(96,165,250,0.8)]"
                  : "border border-edge bg-mist/[0.05] text-mist/85 light:border-black/10 light:bg-black/[0.04] light:text-black/80"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Typing indicator — the assistant's turn, mid-thought */}
        <div
          className="flex justify-start transition-opacity duration-300"
          style={{ opacity: typing ? 1 : 0 }}
          aria-hidden="true"
        >
          <div className="flex gap-1 rounded-2xl border border-edge bg-mist/[0.05] px-4 py-3.5 light:border-black/10 light:bg-black/[0.04]">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 rounded-full bg-mist/50 light:bg-black/40"
                style={{ animation: "talkdot 1.2s ease-in-out infinite", animationDelay: `${d * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* A node buds off for each fact that's landed. */}
      <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
        {CHAT.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full transition-opacity duration-200 ${step >= i ? "node-bud" : "opacity-0"}`}
            style={{
              background: SPECTRUM[i % SPECTRUM.length],
              boxShadow: step >= i ? `0 0 8px 1px ${SPECTRUM[i % SPECTRUM.length]}` : "none",
            }}
          />
        ))}
      </div>

      <style>{`@keyframes talkdot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  )
}

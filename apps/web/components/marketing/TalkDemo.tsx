"use client"

import { useEffect, useRef, useState } from "react"

// §3 split scene: a plain conversation on the left, and on the right the graph writing itself
// — each thing you say becomes a node that pops in. No forms; you just talk.

const CHAT: { who: "ai" | "you"; text: string }[] = [
  { who: "ai", text: "What did you get up to this weekend?" },
  { who: "you", text: "Long run Saturday, then coffee with Sarah." },
  { who: "ai", text: "Nice — still running most mornings?" },
  { who: "you", text: "Yeah, training for a marathon. Been playing guitar too." },
]

// Nodes that grow out of the chat, placed around a central "You".
const NODES = [
  { id: "run", label: "Running", color: "#34d399", x: 78, y: 22, at: 1 },
  { id: "sarah", label: "Sarah", color: "#a78bfa", x: 86, y: 62, at: 1 },
  { id: "marathon", label: "Marathon", color: "#f472b6", x: 60, y: 84, at: 3 },
  { id: "guitar", label: "Guitar", color: "#2dd4bf", x: 30, y: 74, at: 3 },
]
const CENTER = { x: 42, y: 44 }

export default function TalkDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(-1)

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
        // Reveal one chat line at a time; nodes appear as their answer lands.
        // Then hold, reset, and replay — the scene stays alive instead of going static.
        const play = () => {
          timers = CHAT.map((_, i) => setTimeout(() => setStep(i), 400 + i * 1000))
          timers.push(setTimeout(() => setStep(-1), 400 + CHAT.length * 1000 + 3200))
          timers.push(setTimeout(play, 400 + CHAT.length * 1000 + 3900))
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

  const nodeVisible = (at: number) => step >= at

  return (
    <div ref={ref} className="grid items-center gap-6 sm:grid-cols-2">
      {/* Chat */}
      <div className="space-y-3">
        {CHAT.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.who === "you" ? "justify-end" : "justify-start"} transition-all duration-500`}
            style={{ opacity: step >= i ? 1 : 0, transform: step >= i ? "none" : "translateY(10px)" }}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3 text-[15px] ${
                m.who === "you"
                  ? "bg-[#60a5fa] text-black shadow-[0_0_30px_-10px_rgba(96,165,250,0.8)]"
                  : "border border-white/10 bg-white/[0.05] text-white/85 light:border-black/10 light:bg-black/[0.04] light:text-black/80"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* Graph writing itself */}
      <div className="relative aspect-square w-full">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {NODES.map((n) => (
            <line
              key={n.id}
              x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y}
              strokeWidth={0.4}
              style={{ stroke: "var(--g-link-self)", opacity: nodeVisible(n.at) ? 1 : 0, transition: "opacity 0.6s" }}
            />
          ))}
          <circle cx={CENTER.x} cy={CENTER.y} r={4.5} style={{ fill: "var(--g-you)" }} />
          <text x={CENTER.x} y={CENTER.y + 9} textAnchor="middle" fontSize="4" style={{ fontFamily: "var(--font-body)", fill: "var(--g-label-hub)" }}>You</text>
          {NODES.map((n) => (
            <g
              key={n.id}
              style={{
                opacity: nodeVisible(n.at) ? 1 : 0,
                transform: nodeVisible(n.at) ? "scale(1)" : "scale(0)",
                transformOrigin: `${n.x}px ${n.y}px`,
                transition: "opacity 0.5s, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <circle cx={n.x} cy={n.y} r={8} fill={n.color} opacity={0.22} />
              <circle cx={n.x} cy={n.y} r={3.4} fill={n.color} />
              <text x={n.x} y={n.y + 8} textAnchor="middle" fontSize="3.4" style={{ fontFamily: "var(--font-body)", fill: "var(--g-label-hub)" }}>
                {n.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"

// The Thread — a single luminous graph-edge that runs down the entire page as the scroll
// spine. Each section drops an invisible anchor (`data-thread-node`) near its kicker; Thread
// finds them, draws the line to that height via stroke-dashoffset keyed to scroll progress,
// and lights each node in its you-spectrum hue as it enters view. At the asking section the
// line floods amber and every previously-lit node fires a pulse that converges into a gold
// bloom right as the headline resolves — the one orchestrated motion moment on the page.
//
// Positioned as a left rail (the plan permits center-or-left-rail) so it never fights the
// centered/mirrored content columns and degrades trivially: it just sits in the outer gutter
// at every breakpoint instead of needing a mobile-only repositioning rule.

type NodeInfo = { id: string; y: number; color: string; amber: boolean }

const RAIL_X = 18

export default function Thread() {
  const pathRef = useRef<SVGPathElement>(null)
  const [height, setHeight] = useState(0)
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [lit, setLit] = useState<Record<string, boolean>>({})
  const [amberOn, setAmberOn] = useState(false)
  const [burst, setBurst] = useState<{ id: string; fromY: number; toY: number; color: string }[] | null>(null)
  const reduceRef = useRef(false)
  const burstFiredRef = useRef(false)

  const measure = useCallback(() => {
    setHeight(document.documentElement.scrollHeight)
    const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-thread-node]"))
    setNodes(
      anchors.map((el) => ({
        id: el.dataset.threadNode!,
        y: el.getBoundingClientRect().top + window.scrollY,
        color: el.dataset.threadColor || "#60a5fa",
        amber: el.dataset.threadAmber === "true",
      })),
    )
  }, [])

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    measure()
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    // Fonts/reveal transitions can shift layout slightly after first paint — settle once more.
    const t = setTimeout(measure, 500)
    return () => {
      window.removeEventListener("resize", onResize)
      clearTimeout(t)
    }
  }, [measure])

  // Draw the thread as the visitor scrolls (static, fully drawn under reduced motion).
  useEffect(() => {
    const path = pathRef.current
    if (!path || height === 0) return
    path.style.strokeDasharray = `${height}`
    if (reduceRef.current) {
      path.style.strokeDashoffset = "0"
      return
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      path.style.strokeDashoffset = `${height * (1 - progress)}`
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [height])

  // Light each node as its section enters view; flood amber at the asking section.
  useEffect(() => {
    if (!nodes.length) return
    if (reduceRef.current) {
      setLit(Object.fromEntries(nodes.map((n) => [n.id, true])))
      setAmberOn(nodes.some((n) => n.amber))
      return
    }
    const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-thread-node]"))
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          const id = el.dataset.threadNode!
          setLit((prev) => (prev[id] ? prev : { ...prev, [id]: true }))
          if (el.dataset.threadAmber === "true") setAmberOn(true)
        })
      },
      { threshold: 0.5 },
    )
    anchors.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [nodes])

  // "Everything arrives at one question": once, when amber fires, send every already-lit
  // node's pulse down the thread to converge into the gold bloom.
  useEffect(() => {
    if (!amberOn || burstFiredRef.current || reduceRef.current) return
    const amberNode = nodes.find((n) => n.amber)
    if (!amberNode) return
    burstFiredRef.current = true
    const sources = nodes.filter((n) => !n.amber && n.y < amberNode.y)
    setBurst(sources.map((n) => ({ id: n.id, fromY: n.y, toY: amberNode.y, color: n.color })))
    const t = setTimeout(() => setBurst(null), 1100)
    return () => clearTimeout(t)
  }, [amberOn, nodes])

  if (height === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20"
      style={{ height }}
      aria-hidden="true"
    >
      <svg width="4" height={height} className="absolute top-0" style={{ left: RAIL_X - 2 }}>
        {/* Dim base rail — always present, even before the thread has drawn down to it. */}
        <line x1="2" y1="0" x2="2" y2={height} stroke="var(--color-edge)" strokeWidth="2" />
        <path
          ref={pathRef}
          d={`M2,0 L2,${height}`}
          stroke={amberOn ? "var(--color-ask)" : "url(#thread-gradient)"}
          strokeWidth="2"
          fill="none"
          style={{ transition: "stroke 900ms ease" }}
        />
        <defs>
          <linearGradient id="thread-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="35%" stopColor="#60A5FA" />
            <stop offset="65%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
      </svg>

      {nodes.map((n) => {
        const isLit = !!lit[n.id]
        const size = isLit ? (n.amber ? 18 : 13) : 8
        const color = isLit ? (n.amber ? "var(--color-ask)" : n.color) : "var(--color-edge)"
        return (
          <div
            key={n.id}
            className={`absolute rounded-full transition-all duration-500 ${n.amber && isLit ? "thread-bloom" : ""} ${
              n.amber && isLit ? "" : ""
            }`}
            style={{
              left: RAIL_X,
              top: n.y,
              width: size,
              height: size,
              transform: "translate(-50%, -50%)",
              background: color,
              boxShadow: isLit ? `0 0 ${n.amber ? 34 : 16}px ${n.amber ? 6 : 3}px ${color}` : "none",
            }}
          />
        )
      })}

      {burst?.map((b) => (
        <div
          key={b.id}
          className="thread-converge-dot absolute rounded-full"
          style={{
            left: RAIL_X,
            top: b.fromY,
            width: 8,
            height: 8,
            transform: "translate(-50%, -50%)",
            background: b.color,
            boxShadow: `0 0 14px 3px ${b.color}`,
            ["--thread-dist" as string]: `${b.toY - b.fromY}px`,
          }}
        />
      ))}
    </div>
  )
}

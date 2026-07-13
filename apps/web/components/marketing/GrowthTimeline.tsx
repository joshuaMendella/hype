"use client"

import { useEffect, useRef, useState } from "react"
import DemoGraph from "./DemoGraph"

// §4: the same graph, over time. Drag the scrubber (or watch it grow on first view) to see
// weeks of conversations accumulate into a denser map — the "track your progress" story.
export default function GrowthTimeline() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0.28)
  const week = Math.round(1 + progress * 7)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        // Auto-grow once on first view to demonstrate accumulation, then it's the user's to drag.
        const start = performance.now()
        const from = 0.28, to = 0.7, dur = 2600
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / dur)
          setProgress(from + (to - from) * (1 - Math.pow(1 - k, 3)))
          if (k < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="rounded-3xl border border-edge bg-mist/[0.02] p-4 light:border-black/10 light:bg-white sm:p-6">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-3xl">
        <DemoGraph progress={progress} className="h-full w-full" />
      </div>
      <div className="mx-auto mt-4 max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs text-mist/50 light:text-black/50">
          <span>Week 1</span>
          <span className="font-display text-base font-bold text-you-purple light:text-[#7c3aed]">Week {week}</span>
          <span>Week 8</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          aria-label="Scrub through weeks of graph growth"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-mist/15 accent-[#a78bfa] light:bg-black/15 light:accent-[#7c3aed]"
        />
      </div>
    </div>
  )
}

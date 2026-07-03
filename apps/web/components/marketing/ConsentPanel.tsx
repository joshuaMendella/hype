"use client"

import { useState } from "react"

// The signature moment: consent-only ads, demonstrated. An offer card exists ONLY while a
// category is toggled on. Flip everything off and the space says so — nothing shows unless
// you asked for it. This is a mock (no backend); it argues the product's core promise by
// letting you feel it.

type Category = "Style" | "Travel" | "Finance"

const OFFERS: Record<Category, { title: string; detail: string; from: string }> = {
  Style: { title: "Nike Pegasus 41", detail: "The running shoe you mentioned — 20% off this week", from: "Nike" },
  Travel: { title: "Lisbon → Porto by rail", detail: "The trip you're planning — fares from €12", from: "Omio" },
  Finance: { title: "Index fund, 0% fees", detail: "For the investing you started reading about", from: "Trading 212" },
}

const KNOWS = ["Runs most mornings", "Trip to Lisbon in May", "Learning guitar", "Drinks flat whites"]

export default function ConsentPanel() {
  const [on, setOn] = useState<Record<Category, boolean>>({ Style: true, Travel: true, Finance: false })
  const active = (Object.keys(on) as Category[]).filter((c) => on[c])
  const shown = active[0] // one card at a time — the first category you've said yes to

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr]">
      {/* Left: what it knows + the consent switches */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Here&apos;s what I know about you</p>
        <ul className="mt-3 space-y-1.5">
          {KNOWS.map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
              {k}
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs uppercase tracking-[0.2em] text-white/40">Show me offers for</p>
        <div className="mt-3 space-y-2">
          {(Object.keys(on) as Category[]).map((c) => (
            <button
              key={c}
              role="switch"
              aria-checked={on[c]}
              onClick={() => setOn((s) => ({ ...s, [c]: !s[c] }))}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-white/20"
            >
              <span className="text-sm text-white/85">{c}</span>
              <span
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  on[c] ? "bg-[#fbbf24]" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-all ${
                    on[c] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: the offer — present only with consent */}
      <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#fbbf24]/[0.08] to-transparent p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">What you&apos;ll see</p>
        {shown ? (
          <div className="mt-4 flex flex-1 flex-col justify-center">
            <div className="rounded-2xl border border-[#fbbf24]/30 bg-black/40 p-5 shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-[#fbbf24]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#fbbf24]">
                  Sponsored · you said yes
                </span>
                <span className="text-xs text-white/40">{OFFERS[shown].from}</span>
              </div>
              <p className="font-display text-lg font-semibold text-white">{OFFERS[shown].title}</p>
              <p className="mt-1 text-sm text-white/60">{OFFERS[shown].detail}</p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black">See it</span>
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70">No thanks</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <p className="text-sm text-white/70">Nothing.</p>
            <p className="mt-1 max-w-[16rem] text-xs text-white/40">
              That&apos;s the point — turn every switch off and you see no offers at all. Nothing
              shows unless you asked for it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

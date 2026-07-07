"use client"

import { useState } from "react"

// The signature moment, shown the way it actually works in the product: there is no ad
// settings page. The interviewer notices real intent in conversation, ASKS, and the offer
// exists only if you say yes — say no and the chat just moves on. Interactive mock of that
// exact flow (see HYPE_BUSINESS_ASSESSMENT.md, "anatomy of an ad moment").

type Answer = "pending" | "yes" | "no"

export default function ConsentPanel() {
  const [answer, setAnswer] = useState<Answer>("pending")

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.02] p-6 light:border-black/10 light:bg-white sm:p-8">
      <p className="text-xs uppercase tracking-[0.2em] text-white/40 light:text-black/45">A real ad moment</p>

      <div className="mt-5 space-y-3">
        {/* Intent, in the user's own words */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl bg-[#60a5fa] px-5 py-3 text-[15px] text-black">
            Ugh — my running shoes are completely falling apart.
          </div>
        </div>

        {/* Hype asks. It never just shows. */}
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-[15px] text-white/85 light:border-black/10 light:bg-black/[0.04] light:text-black/80">
            Sounds like it&apos;s time. I know your size and the brands you like — want me to
            pull up a couple of current deals?
          </div>
        </div>

        {answer === "pending" && (
          <div className="offer-in flex justify-end gap-2 pt-1">
            <button
              onClick={() => setAnswer("yes")}
              className="rounded-xl bg-[#fbbf24] px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Yes, show me
            </button>
            <button
              onClick={() => setAnswer("no")}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white light:border-black/20 light:text-black/60 light:hover:border-black/40 light:hover:text-black"
            >
              Not now
            </button>
          </div>
        )}

        {answer === "yes" && (
          <div className="offer-in">
            <div className="rounded-2xl border border-[#fbbf24]/30 bg-black/40 p-5 shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)] light:border-[#b45309]/30 light:bg-[#fbbf24]/[0.08]">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-[#fbbf24]/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#fbbf24] light:bg-[#fbbf24]/25 light:text-[#b45309]">
                  Sponsored · you said yes
                </span>
                <span className="text-xs text-white/40 light:text-black/45">Nike</span>
              </div>
              <p className="font-display text-lg font-semibold text-white light:text-[#141414]">Nike Pegasus 41</p>
              <p className="mt-1 text-sm text-white/60 light:text-black/60">
                Your size, the model you mentioned — 20% off this week
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black light:bg-[#141414] light:text-white">See it</span>
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70 light:border-black/20 light:text-black/60">No thanks</span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/40 light:text-black/45">
              One offer, clearly labeled, because you asked. That&apos;s the whole model.
            </p>
          </div>
        )}

        {answer === "no" && (
          <div className="offer-in space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-[15px] text-white/85 light:border-black/10 light:bg-black/[0.04] light:text-black/80">
                No problem. So — how did Saturday&apos;s long run go?
              </div>
            </div>
            <p className="text-center text-xs text-white/40 light:text-black/45">
              No ad. The conversation just carries on, and it won&apos;t ask twice.
            </p>
          </div>
        )}
      </div>

      {answer !== "pending" && (
        <button
          onClick={() => setAnswer("pending")}
          className="mt-5 w-full text-center text-xs text-white/40 light:text-black/45 transition-colors hover:text-white/70 light:hover:text-black/70"
        >
          ↺ Try the other answer
        </button>
      )}
    </div>
  )
}

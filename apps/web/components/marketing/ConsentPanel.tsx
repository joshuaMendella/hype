"use client"

import { useState } from "react"

// The signature moment, shown the way it actually works: there is no ad settings page. The
// interviewer notices real intent, ASKS, and the suggestion exists only if you say yes — say
// no and the chat just moves on. This card is committed-dark (no theme variants) because it
// floats on the gold "asking" section, which is identical in light and dark.

type Answer = "pending" | "yes" | "no"

export default function ConsentPanel() {
  const [answer, setAnswer] = useState<Answer>("pending")

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-ask/20 bg-[#100c04] p-6 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.8)] sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/40">A real moment, start to finish</p>

      <div className="mt-5 space-y-3">
        {/* Intent, in the user's own words */}
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl bg-you-blue px-5 py-3 text-[1.0625rem] text-void">
            Ugh — my running shoes are completely falling apart.
          </div>
        </div>

        {/* Hype asks. It never just shows. */}
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl border border-edge bg-white/[0.06] px-5 py-3 text-[1.0625rem] text-white/85">
            Sounds like it&apos;s time. I know your size and the brands you like — want me to
            show you what I found?
          </div>
        </div>

        {answer === "pending" && (
          <div className="offer-in flex justify-end gap-2 pt-1">
            <button
              onClick={() => setAnswer("yes")}
              className="rounded-xl bg-ask px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.03]"
            >
              Yes, show me
            </button>
            <button
              onClick={() => setAnswer("no")}
              className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
            >
              Not now
            </button>
          </div>
        )}

        {answer === "yes" && (
          <div className="offer-in">
            <div className="rounded-2xl border border-ask/30 bg-black/50 p-5 shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-ask/15 px-2 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wider text-ask">
                  Sponsored · you said yes
                </span>
                <span className="text-xs text-white/40">Nike</span>
              </div>
              <p className="font-display text-lg font-bold text-white">Nike Pegasus 41</p>
              <p className="mt-1 text-sm text-white/60">
                Your size, the model you mentioned — 20% off this week
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black">See it</span>
                <span className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/70">No thanks</span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-white/40">
              One find, clearly labeled, because you asked. That&apos;s the whole idea.
            </p>
          </div>
        )}

        {answer === "no" && (
          <div className="offer-in space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-edge bg-white/[0.06] px-5 py-3 text-[1.0625rem] text-white/85">
                No problem. So — how did Saturday&apos;s long run go?
              </div>
            </div>
            <p className="text-center text-xs text-white/40">
              Nothing appears. The conversation just carries on, and it won&apos;t ask twice.
            </p>
          </div>
        )}
      </div>

      {answer !== "pending" && (
        <button
          onClick={() => setAnswer("pending")}
          className="mt-5 w-full text-center text-xs text-white/40 transition-colors hover:text-white/70"
        >
          ↺ Try the other answer
        </button>
      )}
    </div>
  )
}

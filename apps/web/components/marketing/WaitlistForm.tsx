"use client"

import { useState } from "react"

// Email capture for the beta waitlist. Both placements (hero dusk, footer night)
// sit on dark sky, so this is styled for dark surfaces only.
export default function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle")

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state === "busy") return
    setState("busy")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "done") {
    return (
      <p className="font-body rounded-full border border-white/20 bg-white/10 px-6 py-3 text-center text-sm text-star backdrop-blur">
        You&apos;re on the list — talk soon. ✓
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="relative flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle") }}
        placeholder="you@example.com"
        aria-label="Email address"
        className="font-body min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm text-star placeholder:text-star/40 backdrop-blur outline-none transition focus:border-white/60"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="font-body shrink-0 rounded-full bg-star px-6 py-3 text-sm font-semibold text-dusk-0 shadow-[0_0_32px_-8px_rgba(244,241,255,0.7)] transition hover:scale-[1.03] disabled:opacity-60"
      >
        {state === "busy" ? "Joining…" : "Join the waitlist"}
      </button>
      {state === "error" && (
        <p className="font-body text-xs text-[#fca5a5] sm:absolute sm:top-full sm:left-0 sm:mt-2" role="alert">
          That didn&apos;t work — check the email and try again.
        </p>
      )}
    </form>
  )
}

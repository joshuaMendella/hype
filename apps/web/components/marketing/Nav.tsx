"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import ThemeToggle from "./ThemeToggle"

// Sticky top nav — transparent over the hero, gains a blurred bar once you scroll.
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-white/10 bg-black/60 backdrop-blur-xl light:border-black/10 light:bg-white/70"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight">
          Hype
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm text-white/70 transition-colors hover:text-white light:text-black/60 light:hover:text-black"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black shadow-[0_0_24px_-6px_rgba(255,255,255,0.6)] transition-transform hover:scale-[1.03] light:bg-[#141414] light:text-white light:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.4)]"
          >
            Try Hype free
          </Link>
        </div>
      </nav>
    </header>
  )
}

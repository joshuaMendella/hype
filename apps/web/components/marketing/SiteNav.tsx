"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

// Sticky top nav — transparent over the dusk hero, gains a dark blurred bar on scroll.
export default function SiteNav() {
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
        scrolled ? "border-b border-white/10 bg-dusk-0/70 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-star">
          Hype
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <a href="#how-it-works" className="font-body hidden px-3 py-2 text-sm text-star/70 transition-colors hover:text-star sm:block">
            How it works
          </a>
          <a href="#the-deal" className="font-body hidden px-3 py-2 text-sm text-star/70 transition-colors hover:text-star sm:block">
            The deal
          </a>
          <Link href="/login" className="font-body px-3 py-2 text-sm text-star/70 transition-colors hover:text-star">
            Sign in
          </Link>
          <a
            href="#join"
            className="font-body rounded-full bg-star px-4 py-2 text-sm font-semibold text-dusk-0 transition-transform hover:scale-[1.03]"
          >
            Join the waitlist
          </a>
        </div>
      </nav>
    </header>
  )
}

"use client"

import { useEffect, useState } from "react"

// Light/dark switch for the landing page. Sets data-theme="light" on <html>; the
// `light:` Tailwind variant in globals.css keys off it. Dark is the default.
export default function ThemeToggle() {
  const [light, setLight] = useState(false)

  const apply = (next: boolean) => {
    setLight(next)
    if (next) document.documentElement.dataset.theme = "light"
    else delete document.documentElement.dataset.theme
    localStorage.setItem("hype-theme", next ? "light" : "dark")
  }

  useEffect(() => {
    if (localStorage.getItem("hype-theme") === "light") apply(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <button
      onClick={() => apply(!light)}
      role="switch"
      aria-checked={light}
      aria-label="Switch between dark and light mode"
      className="relative h-8 w-[3.6rem] rounded-full border border-white/15 bg-white/[0.06] transition-colors hover:border-white/30 light:border-black/15 light:bg-black/[0.05] light:hover:border-black/30"
    >
      <span
        className={`absolute top-[3px] flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] leading-none text-black shadow transition-all duration-300 light:bg-[#141414] light:text-white ${
          light ? "left-[calc(100%-1.65rem)]" : "left-[3px]"
        }`}
      >
        {light ? "☀" : "☾"}
      </span>
    </button>
  )
}

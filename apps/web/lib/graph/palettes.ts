// Single source of truth for graph coloring. GraphCanvas reads node colors from
// here; the Graph-settings drawer picks a mode + background. Modes are generative
// HSL transforms over one base map — no hand-authored alternate palettes.
import { hsl } from "d3"

// Base semantic map: topic -> hex (Work=blue, Food=orange, …). "Vibrant" mode.
const BASE_COLORS: Record<string, string> = {
  Profile:        "#ffffff",
  Work:           "#60a5fa", Finance:      "#93c5fd", Education:  "#818cf8", Technology: "#6366f1",
  Relationships:  "#a78bfa", Social:       "#c084fc", Community:  "#d8b4fe", Parenting:  "#e879f9",
  Style:          "#f472b6", Beauty:       "#fb7185",
  Food:           "#fb923c", Home:         "#fbbf24",
  Health:         "#4ade80", Sports:       "#34d399", Hobbies:    "#2dd4bf",
  Goals:          "#facc15", Beliefs:      "#eab308", Identity:   "#fde68a",
  Travel:         "#67e8f9", Location:     "#22d3ee",
  Entertainment:  "#f9a8d4", Gaming:       "#c026d3", Creativity: "#a855f7", Events: "#f0abfc",
  "Life Events":  "#94a3b8", "Life Stage": "#64748b", Childhood:  "#fca5a5", Routine:    "#86efac",
  Pets:           "#fde047", Vehicle:      "#94a3b8", "Real Estate": "#78716c",
}
const DEFAULT_COLOR = "#6b7280"

export const PALETTE_MODES = ["vibrant", "pastel", "neon", "mono"] as const
export type PaletteMode = (typeof PALETTE_MODES)[number]

export const BACKGROUNDS: { name: string; value: string }[] = [
  { name: "Near black", value: "#0d0d0d" },
  { name: "Charcoal", value: "#1a1a1e" },
  { name: "Deep navy", value: "#0b1020" },
  { name: "Warm dark", value: "#171310" },
]

export interface GraphSettings {
  palette: PaletteMode
  background: string
}

export const DEFAULT_SETTINGS: GraphSettings = { palette: "vibrant", background: "#0d0d0d" }

// Transform one base hex by mode. Profile (white) is left as-is so the root anchor
// stays the visual anchor across every mode.
function transform(hex: string, mode: PaletteMode): string {
  if (mode === "vibrant") return hex
  const c = hsl(hex)
  if (Number.isNaN(c.h)) return hex // greys/white have no hue — leave them
  switch (mode) {
    case "pastel": c.s = Math.max(0, c.s * 0.55); c.l = Math.min(1, c.l * 1.15); break
    case "neon":   c.s = Math.min(1, c.s * 1.3 + 0.15); c.l = Math.min(0.72, c.l); break
    case "mono":   c.h = 210; c.s = 0.35; break // single hue, topics differ by lightness only
  }
  return c.formatHex()
}

export function nodeColorFor(topic: string | null, mode: PaletteMode): string {
  const base = BASE_COLORS[topic ?? ""] ?? DEFAULT_COLOR
  return transform(base, mode)
}

// localStorage persistence — cosmetic, per-browser (no backend). Upgrade to a
// profiles JSONB column if cross-device sync is ever needed.
const STORAGE_KEY = "hype:graph-settings"

export function loadSettings(): GraphSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: GraphSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    /* ignore quota/private-mode failures — cosmetic only */
  }
}

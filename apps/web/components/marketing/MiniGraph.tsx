import { nodeColorFor, type PaletteMode } from "@/lib/graph/palettes"

// Static mini graph for the palette showcase — hardcoded layout, colors computed
// through the app's real palette transform so every mode shown is the genuine article.
// ponytail: positions hand-placed, no d3 — 11 nodes don't need a simulation.
const NODES: { id: string; topic: string; x: number; y: number; r: number }[] = [
  { id: "you", topic: "Profile", x: 100, y: 75, r: 9 },
  { id: "a", topic: "Sports", x: 48, y: 38, r: 6 },
  { id: "b", topic: "Relationships", x: 152, y: 34, r: 6 },
  { id: "c", topic: "Work", x: 170, y: 92, r: 6 },
  { id: "d", topic: "Travel", x: 132, y: 126, r: 6 },
  { id: "e", topic: "Food", x: 58, y: 118, r: 6 },
  { id: "f", topic: "Hobbies", x: 26, y: 82, r: 5 },
  { id: "g", topic: "Style", x: 22, y: 20, r: 4 },
  { id: "h", topic: "Entertainment", x: 182, y: 18, r: 4 },
  { id: "i", topic: "Location", x: 176, y: 132, r: 4 },
  { id: "j", topic: "Health", x: 74, y: 22, r: 4 },
]
const LINKS: [string, string][] = [
  ["you", "a"], ["you", "b"], ["you", "c"], ["you", "d"], ["you", "e"], ["you", "f"],
  ["a", "g"], ["a", "j"], ["b", "h"], ["d", "i"], ["e", "d"],
]
const at = (id: string) => NODES.find((n) => n.id === id)!

export default function MiniGraph({ mode }: { mode: PaletteMode }) {
  return (
    <svg viewBox="0 0 200 150" className="h-auto w-full" aria-hidden="true">
      <rect width="200" height="150" rx="12" fill="#0d0d0d" />
      {LINKS.map(([s, t]) => (
        <line key={`${s}-${t}`} x1={at(s).x} y1={at(s).y} x2={at(t).x} y2={at(t).y} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      ))}
      {NODES.map((n) => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={n.r + 4} fill={nodeColorFor(n.topic, mode)} opacity="0.18" />
          <circle cx={n.x} cy={n.y} r={n.r} fill={nodeColorFor(n.topic, mode)} opacity="0.95" />
        </g>
      ))}
    </svg>
  )
}

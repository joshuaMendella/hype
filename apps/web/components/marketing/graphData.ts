// Seeded demo graph for the landing page — a believable slice of one person's life.
// No Supabase, no auth. Colors are lifted from the app's real TOPIC_COLORS so the
// landing page and the product share one visual language.
// ponytail: hardcoded hex (subset of GraphCanvas TOPIC_COLORS) — a data file shouldn't
// import the d3/supabase-coupled canvas just to read six colors.

export interface DemoNode {
  id: string
  label: string
  color: string
  /** Root nodes (hang off "You") are bigger. */
  hub?: boolean
  /** 0..1 — when this node appears as the growth scrubber advances. */
  revealAt: number
}

export interface DemoLink {
  s: string
  t: string
  /** "self" = You→root spine, "brand" = brand→item nest, "relation" = entity↔entity. */
  kind: "self" | "brand" | "relation"
}

const C = {
  you: "#ffffff",
  work: "#60a5fa",
  finance: "#93c5fd",
  sports: "#34d399",
  health: "#4ade80",
  food: "#fb923c",
  travel: "#67e8f9",
  style: "#f472b6",
  home: "#fbbf24",
  hobbies: "#2dd4bf",
  relationships: "#a78bfa",
  entertainment: "#f9a8d4",
  creativity: "#a855f7",
  location: "#22d3ee",
}

export const DEMO_NODES: DemoNode[] = [
  { id: "you", label: "You", color: C.you, hub: true, revealAt: 0 },

  // Core self — present from week one
  { id: "running", label: "Running", color: C.sports, hub: true, revealAt: 0 },
  { id: "sarah", label: "Sarah", color: C.relationships, hub: true, revealAt: 0 },
  { id: "acme", label: "Acme", color: C.work, hub: true, revealAt: 0.05 },
  { id: "lisbon", label: "Lisbon", color: C.travel, hub: true, revealAt: 0.1 },

  // Fills in as the graph grows
  { id: "pegasus", label: "Nike Pegasus", color: C.style, revealAt: 0.25 },
  { id: "bluebottle", label: "Blue Bottle", color: C.food, hub: true, revealAt: 0.3 },
  { id: "flatwhite", label: "Flat white", color: C.food, revealAt: 0.45 },
  { id: "guitar", label: "Guitar", color: C.hobbies, hub: true, revealAt: 0.4 },
  { id: "apartment", label: "Apartment", color: C.home, hub: true, revealAt: 0.5 },

  // Later weeks
  { id: "photography", label: "Photography", color: C.creativity, hub: true, revealAt: 0.65 },
  { id: "dune", label: "Dune", color: C.entertainment, revealAt: 0.7 },
  { id: "gym", label: "Gym", color: C.health, hub: true, revealAt: 0.78 },
  { id: "investing", label: "Investing", color: C.finance, hub: true, revealAt: 0.85 },
  { id: "porto", label: "Porto", color: C.location, revealAt: 0.92 },
  { id: "marathon", label: "Marathon", color: C.sports, revealAt: 1 },
]

export const DEMO_LINKS: DemoLink[] = [
  { s: "you", t: "running", kind: "self" },
  { s: "you", t: "sarah", kind: "self" },
  { s: "you", t: "acme", kind: "self" },
  { s: "you", t: "lisbon", kind: "self" },
  { s: "you", t: "bluebottle", kind: "self" },
  { s: "you", t: "guitar", kind: "self" },
  { s: "you", t: "apartment", kind: "self" },
  { s: "you", t: "photography", kind: "self" },
  { s: "you", t: "gym", kind: "self" },
  { s: "you", t: "investing", kind: "self" },

  { s: "running", t: "pegasus", kind: "brand" },
  { s: "running", t: "marathon", kind: "relation" },
  { s: "bluebottle", t: "flatwhite", kind: "brand" },
  { s: "photography", t: "dune", kind: "relation" },
  { s: "lisbon", t: "porto", kind: "relation" },
  { s: "sarah", t: "lisbon", kind: "relation" },
  { s: "gym", t: "running", kind: "relation" },
]

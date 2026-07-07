import type { Topic } from "./topics"
export type { Topic }

export type NoteSource = "conversation" | "inferred" | "user-confirmed" | "system"

export type MessageRole = "user" | "assistant"

export type EntityType = "item" | "brand" | "place" | "person" | "event" | "org" | "interest"

export interface VaultNote {
  id: string
  user_id: string
  path: string
  title: string
  topic: Topic | null
  content_md: string
  confidence: number
  intent: boolean
  source: NoteSource
  entity_type: EntityType | null
  created_at: string
  updated_at: string
}

export interface VaultLink {
  id: string
  user_id: string
  source_note_id: string
  target_note_id: string
  anchor_text: string | null
  link_type: "brand" | "tag" | "relation" | "located_in" | null
  created_at: string
}

// Graph-specific types for the D3 visualization
export interface GraphNode {
  id: string
  title: string
  topic: Topic | null
  path: string
  intent: boolean
  wordCount: number
  source: NoteSource
  entity_type: EntityType | null
  attributes: { label: string; value: string }[]
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
}

export interface GraphLink {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  anchor_text: string | null
  // "self" edges are synthesized client-side (You → top-level entity); never persisted.
  link_type: "brand" | "tag" | "relation" | "located_in" | "self" | null
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

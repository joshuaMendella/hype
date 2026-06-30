import type { Topic } from "@/lib/ai/topics"
export type { Topic }

export type NoteSource = "conversation" | "inferred" | "user-confirmed" | "system"

export type MessageRole = "user" | "assistant"

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  onboarded: boolean
  // Per-category ad consent — { [affiliateCategory]: boolean }. A referral is only
  // "verified consent" (and worth CPC/CPA) when its category is true here.
  ad_preferences: Record<string, boolean>
  created_at: string
  updated_at: string
}

export type IntentStatus = "open" | "offered" | "converted" | "expired"

export interface Intent {
  id: string
  user_id: string
  entity_note_id: string | null
  category: string | null
  utterance: string | null
  confidence: number
  status: IntentStatus
  created_at: string
  expires_at: string | null
}

export type EntityType = "item" | "brand" | "place" | "person" | "event"

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
  link_type: "brand" | "tag" | null
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  status: "active" | "completed"
  agenda: import("@/lib/ai/checklists").Agenda | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  created_at: string
}

export interface Extraction {
  id: string
  conversation_id: string
  note_id: string
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
  link_type: "brand" | "tag" | "self" | null
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

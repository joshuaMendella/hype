export type Topic =
  | "Profile"
  | "Work"
  | "Style"
  | "Food"
  | "Fitness"
  | "People"
  | "Goals"
  | "Insights"

export type NoteSource = "conversation" | "inferred" | "user-confirmed" | "system"

export type MessageRole = "user" | "assistant"

export interface Profile {
  id: string
  email: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface VaultNote {
  id: string
  user_id: string
  path: string
  title: string
  topic: Topic | null
  content_md: string
  confidence: number
  source: NoteSource
  created_at: string
  updated_at: string
}

export interface VaultLink {
  id: string
  user_id: string
  source_note_id: string
  target_note_id: string
  anchor_text: string | null
  created_at: string
}

export interface Conversation {
  id: string
  user_id: string
  status: "active" | "completed"
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
  wordCount: number
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
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

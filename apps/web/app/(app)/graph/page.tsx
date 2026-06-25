import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import GraphCanvas from "@/components/graph/GraphCanvas"
import ChatPanel from "@/components/chat/ChatPanel"
import type { GraphData } from "@/types/database"

export default async function GraphPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [{ data: notes }, { data: links }] = await Promise.all([
    supabase.from("vault_notes").select("id, title, topic, path, content_md"),
    supabase.from("vault_links").select("id, source_note_id, target_note_id, anchor_text"),
  ])

  const userName: string | null = user.user_metadata?.display_name ?? null

  const graphData: GraphData = {
    nodes: (notes ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      topic: n.topic,
      path: n.path,
      wordCount: n.content_md?.split(" ").length ?? 1,
    })),
    links: (links ?? []).map((l) => ({
      id: l.id,
      source: l.source_note_id,
      target: l.target_note_id,
      anchor_text: l.anchor_text,
    })),
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      {/* Full-screen graph */}
      <GraphCanvas initialData={graphData} />

      {/* AI chat panel — overlays the bottom-right of the graph */}
      <ChatPanel userId={user.id} userName={userName} />
    </div>
  )
}

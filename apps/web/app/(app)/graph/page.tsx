import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import GraphWrapper from "@/components/graph/GraphWrapper"
import { parseAttributes } from "@/components/graph/parseAttributes"
import type { GraphData } from "@/types/database"

export default async function GraphPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const [{ data: notes }, { data: links }] = await Promise.all([
    supabase.from("vault_notes").select("id, title, topic, path, content_md, intent, source, entity_type"),
    supabase.from("vault_links").select("id, source_note_id, target_note_id, anchor_text, link_type"),
  ])

  const userName: string | null = user.user_metadata?.display_name ?? null

  const graphData: GraphData = {
    nodes: (notes ?? []).map((n) => ({
      id: n.id,
      title: n.title,
      topic: n.topic,
      path: n.path,
      intent: n.intent ?? false,
      wordCount: n.content_md?.split(" ").length ?? 1,
      source: n.source ?? "conversation",
      entity_type: n.entity_type ?? null,
      attributes: parseAttributes(n.content_md),
    })),
    links: (links ?? []).map((l) => ({
      id: l.id,
      source: l.source_note_id,
      target: l.target_note_id,
      anchor_text: l.anchor_text,
      link_type: l.link_type ?? null,
    })),
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <GraphWrapper initialData={graphData} userId={user.id} userName={userName} />
    </div>
  )
}

import { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import type { GraphData } from "@hype/shared"
import { supabase } from "../lib/supabase"
import GraphCanvasSkia from "../components/GraphCanvasSkia"
import ChatPanel from "../components/ChatPanel"

// Graph home. Phase 5: live vault_notes / vault_links query (same select shape as
// web graph/page.tsx). RLS scopes both tables to the signed-in user via the
// session's Bearer token. Node-birth animation lands with chat (Phase 6) — nothing
// grows the graph mid-session until then, so there's nothing to animate yet.
export default function Graph() {
  const [data, setData] = useState<GraphData | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace("/login")
      return
    }
    const [notes, links] = await Promise.all([
      supabase.from("vault_notes").select("id, title, topic, path, content_md, intent, source, entity_type"),
      supabase.from("vault_links").select("id, source_note_id, target_note_id, anchor_text, link_type"),
    ])
    if (notes.error || links.error) {
      setError(true)
      return
    }
    setData({
      // attributes/wordCount aren't rendered by the Skia canvas — skip parseAttributes.
      nodes: (notes.data ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        topic: n.topic,
        path: n.path,
        intent: n.intent ?? false,
        wordCount: 1,
        source: n.source ?? "conversation",
        entity_type: n.entity_type ?? null,
        attributes: [],
      })),
      links: (links.data ?? []).map((l) => ({
        id: l.id,
        source: l.source_note_id,
        target: l.target_note_id,
        anchor_text: l.anchor_text,
        link_type: l.link_type ?? null,
      })),
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Extraction is fire-and-forget server-side (after()), so there's no completion
  // signal after a reply. Poll twice — covers fast and slow extractions — same as web.
  const scheduleRefresh = useCallback(() => {
    setTimeout(load, 3000)
    setTimeout(load, 6500)
  }, [load])

  async function signOut() {
    await supabase.auth.signOut()
    router.replace("/login")
  }

  if (error) {
    return (
      <Center>
        <Text style={{ color: "#ff6b6b", marginBottom: 12 }}>Couldn't load your graph.</Text>
        <Pressable onPress={() => { setError(false); load() }} hitSlop={8}>
          <Text style={{ color: "#67e8f9" }}>Retry</Text>
        </Pressable>
      </Center>
    )
  }

  if (!data) {
    return <Center><ActivityIndicator color="#fff" /></Center>
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0d0d0d" }}>
      {/* Empty graph (new user) → just the dark canvas; the chat opener drives the
          first turn and nodes appear as they talk. */}
      {data.nodes.length > 0 && <GraphCanvasSkia data={data} />}
      <ChatPanel onReply={scheduleRefresh} />
      <SafeAreaView style={{ position: "absolute", top: 0, right: 0 }} pointerEvents="box-none">
        <Pressable onPress={signOut} style={{ padding: 16 }} hitSlop={8}>
          <Text style={{ color: "#ff6b6b", fontSize: 14 }}>Sign out</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0d0d0d", alignItems: "center", justifyContent: "center" }}>
      {children}
    </View>
  )
}

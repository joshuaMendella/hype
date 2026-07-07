import { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { supabase } from "../lib/supabase"

type ChatMessage = { role: "user" | "assistant"; content: string }

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? ""

// ponytail: word-by-word reveal via recursive setTimeout — same logic as web, no anim lib.
function useTypewriter(text: string, speed = 85) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!text) { setDisplayed(""); setDone(false); return }
    setDisplayed("")
    setDone(false)
    const words = text.split(" ")
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    function tick() {
      i++
      setDisplayed(words.slice(0, i).join(" "))
      if (i < words.length) timer = setTimeout(tick, speed)
      else setDone(true)
    }
    timer = setTimeout(tick, speed)
    return () => clearTimeout(timer)
  }, [text, speed])
  return { displayed, done }
}

// POST to the web app's /api/chat with the session JWT as a Bearer token (the
// bearer path is live server-side, Phase 3). The route reads only `messages` and
// derives the user from the token. Ad `card` in the response is ignored for now —
// ad-moment UI is a separate roadmap item.
async function postChat(messages: ChatMessage[]): Promise<{ reply: string } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { error: "auth" }
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { error: body.error === "rate_limit" ? "rate_limit" : "server" }
  }
  return res.json()
}

// Mobile chat overlay. AI line up top, single input at the bottom; one message at a
// time (no scrollback), mirroring web. onReply → graph reload so new nodes appear.
// ponytail: no <2h session restore yet (web does it server-side) — each open fetches
// a fresh opener; add restore if starting mid-conversation feels wrong on device.
export default function ChatPanel({ onReply }: { onReply?: () => void }) {
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [currentAi, setCurrentAi] = useState("")
  const [aiVisible, setAiVisible] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [canInput, setCanInput] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const { displayed, done } = useTypewriter(currentAi)

  // Opener on mount.
  useEffect(() => {
    postChat([])
      .then((r) => setCurrentAi("reply" in r ? r.reply : "Hey — what have you been up to today?"))
      .catch(() => setCurrentAi("Hey — what have you been up to today?"))
      .finally(() => { setAiVisible(true); setLoading(false) })
  }, [])

  useEffect(() => { if (done) setCanInput(true) }, [done])
  useEffect(() => { if (canInput) inputRef.current?.focus() }, [canInput])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !canInput) return
    setCanInput(false)
    setInput("")
    setLoading(true)
    setAiVisible(false)

    const next: ChatMessage[] = [
      ...history,
      { role: "assistant", content: currentAi },
      { role: "user", content: text },
    ]
    setHistory(next)

    const r = await postChat(next)
    if ("reply" in r) {
      setCurrentAi(r.reply)
      onReply?.()
    } else {
      setCurrentAi(r.error === "rate_limit"
        ? "I've hit my daily message limit — check back in a bit."
        : "Something slipped on my end — want to try that again?")
    }
    setLoading(false)
    setAiVisible(true)
  }, [input, loading, canInput, history, currentAi, onReply])

  return (
    <KeyboardAvoidingView
      style={{ position: "absolute", inset: 0 }}
      pointerEvents="box-none"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* AI voice — top */}
      <SafeAreaView pointerEvents="none" style={{ paddingHorizontal: 28, paddingTop: 24 }}>
        <View style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 16, padding: 18 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.9)",
              fontSize: currentAi.length > 160 ? 16 : 20,
              fontWeight: "300",
              lineHeight: 28,
              textAlign: "center",
              opacity: aiVisible ? 1 : 0.3,
              minHeight: 28,
            }}
          >
            {displayed}
            {!done && aiVisible ? " ▍" : ""}
          </Text>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }} pointerEvents="none" />

      {/* User input — bottom */}
      <SafeAreaView edges={["bottom"]} style={{ paddingHorizontal: 28, paddingBottom: 8 }}>
        {loading ? (
          <ActivityIndicator color="rgba(167,139,250,0.7)" style={{ paddingVertical: 16 }} />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.22)" }}>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              editable={canInput}
              placeholder={canInput ? "your answer…" : ""}
              placeholderTextColor="rgba(255,255,255,0.3)"
              returnKeyType="send"
              autoCorrect={false}
              style={{ flex: 1, color: "rgba(255,255,255,0.85)", fontSize: 17, paddingVertical: 10, paddingRight: 12 }}
            />
            {canInput && input.trim() ? (
              <Pressable onPress={send} hitSlop={10}>
                <Text style={{ color: "rgba(167,139,250,0.85)", fontSize: 22 }}>➤</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}

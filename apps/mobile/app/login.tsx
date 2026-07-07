import { useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native"
import { router } from "expo-router"
import { supabase } from "../lib/supabase"

// Sign-in only (signup deferred per plan — test with an existing account).
export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) setError(error.message)
    else router.replace("/graph")
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#0a0a0a", justifyContent: "center", padding: 24 }}
    >
      <Text style={{ color: "#fff", fontSize: 32, fontWeight: "700", marginBottom: 4 }}>Hype</Text>
      <Text style={{ color: "#888", fontSize: 15, marginBottom: 28 }}>Sign in to your graph</Text>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#666"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={inputStyle}
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#666"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={inputStyle}
      />

      {error && <Text style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</Text>}

      <Pressable
        onPress={signIn}
        disabled={loading || !email || !password}
        style={{
          backgroundColor: loading || !email || !password ? "#333" : "#fff",
          borderRadius: 12,
          paddingVertical: 15,
          alignItems: "center",
          marginTop: 8,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={{ color: "#000", fontWeight: "600", fontSize: 16 }}>Sign in</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  )
}

const inputStyle = {
  backgroundColor: "#161616",
  borderRadius: 12,
  color: "#fff",
  fontSize: 16,
  paddingHorizontal: 16,
  paddingVertical: 14,
  marginBottom: 14,
} as const

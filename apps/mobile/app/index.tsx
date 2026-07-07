import { useEffect, useState } from "react"
import { ActivityIndicator, View } from "react-native"
import { Redirect } from "expo-router"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "../lib/supabase"

// Auth gate: send to /graph if a session exists, else /login.
export default function Index() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0a0a0a", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }
  return <Redirect href={session ? "/graph" : "/login"} />
}

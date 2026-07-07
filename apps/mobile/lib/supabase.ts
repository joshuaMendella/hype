import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"
import { AppState } from "react-native"

// Plain supabase-js client (NOT @supabase/ssr — that's cookie/SSR-specific).
// Session persists in AsyncStorage. ponytail: not expo-secure-store — Android's
// SecureStore has a ~2KB per-value cap that truncates the JWT session; AsyncStorage
// is what the Supabase RN guide uses. Move to secure-store only if we split the
// token out under its size.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// Refresh the token only while the app is foregrounded (Supabase RN guide).
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

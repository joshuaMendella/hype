// apps/web/lib/onboarding/seed.ts
import { createClient } from "@/lib/supabase/client"

// Flip the onboarding flag once the scripted beats are done (client-side RLS write).
// Node seeding moved to POST /api/onboarding/seed (it needs the server-only Gemini key).
export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("profiles").update({ onboarded: true }).eq("id", userId)
}

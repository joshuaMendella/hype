import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

// ponytail: placeholder while the new landing page is designed — logged-in → graph,
// everyone else → signup. Replace with the marketing page.
export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  redirect(user ? "/graph" : "/signup")
}

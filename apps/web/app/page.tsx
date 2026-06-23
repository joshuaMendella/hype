import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Send logged-in users to their graph, others to sign up
  if (user) redirect("/graph")
  redirect("/signup")
}

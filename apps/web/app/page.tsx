import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Landing from "@/components/marketing/Landing"

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Logged-in users go straight to their graph; everyone else sees the pitch.
  if (user) redirect("/graph")

  return <Landing />
}

import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

// Owner-only gate — fails closed. Renders a 404 (never a redirect) so the route's
// existence is never advertised to anyone who isn't the configured owner.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ownerId = process.env.ADMIN_USER_ID
  if (!ownerId || !user || user.id !== ownerId) notFound()

  return <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">{children}</div>
}

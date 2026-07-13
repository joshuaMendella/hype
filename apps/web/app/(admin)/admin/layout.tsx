import { notFound } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

// Owner-only gate — fails closed. Renders a 404 (never a redirect) so the route's
// existence is never advertised to anyone who isn't the configured owner.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ownerId = process.env.ADMIN_USER_ID
  if (!ownerId || !user || user.id !== ownerId) notFound()

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <nav className="max-w-6xl mx-auto mb-6 flex gap-4 text-sm text-neutral-400">
        <Link href="/admin" className="hover:text-neutral-100">Dashboard</Link>
        <Link href="/admin/roadmap" className="hover:text-neutral-100">Roadmap</Link>
      </nav>
      {children}
    </div>
  )
}

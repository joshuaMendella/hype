import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

type Profile = { id: string; email: string | null; display_name: string | null; created_at: string; onboarded: boolean | null }
type Conversation = { id: string; user_id: string }
type Message = { conversation_id: string; role: "user" | "assistant"; created_at: string }
type VaultNote = { user_id: string; source: string | null; content_md: string | null; created_at: string }
type Intent = { user_id: string; status: string }
type Event = { kind: string; detail: Record<string, unknown> | null; user_id: string | null; created_at: string }

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function relativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default async function AdminPage() {
  // Defense in depth: re-check the owner gate at the data, not only in the layout. In the
  // App Router a layout and its page render concurrently, so a layout-only notFound() would
  // not stop these admin-client (RLS-bypassing) reads from executing for a non-owner.
  const ownerId = process.env.ADMIN_USER_ID
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!ownerId || !user || user.id !== ownerId) notFound()

  const admin = createAdminClient()
  const sevenDaysAgoIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  // ponytail: in-JS aggregation pulls full tables (profiles/conversations/messages/vault_notes/
  // intents) and joins client-side. Fine at current scale; once users cross a few hundred this
  // should become a SQL rollup (a view or RPC) instead of hauling every row into the Node process.
  const [
    { data: profiles },
    { data: conversations },
    { data: messages },
    { data: vaultNotes },
    { data: intents },
    { data: events },
    { count: fallbackCount },
    { count: failureCount },
  ] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, created_at, onboarded"),
    admin.from("conversations").select("id, user_id"),
    admin.from("messages").select("conversation_id, role, created_at"),
    admin.from("vault_notes").select("user_id, source, content_md, created_at").eq("source", "conversation"),
    admin.from("intents").select("user_id, status"),
    admin.from("events").select("kind, detail, user_id, created_at").order("created_at", { ascending: false }).limit(50),
    admin.from("events").select("id", { count: "exact", head: true })
      .in("kind", ["chat_fallback", "extract_fallback"]).gte("created_at", sevenDaysAgoIso),
    admin.from("events").select("id", { count: "exact", head: true })
      .in("kind", ["chat_failed_both", "extract_failed_both"]).gte("created_at", sevenDaysAgoIso),
  ])

  const profileRows = (profiles ?? []) as Profile[]
  const conversationRows = (conversations ?? []) as Conversation[]
  const messageRows = (messages ?? []) as Message[]
  const vaultNoteRows = (vaultNotes ?? []) as VaultNote[]
  const intentRows = (intents ?? []) as Intent[]
  const eventRows = (events ?? []) as Event[]

  // conversationId -> userId
  const convUser = new Map<string, string>()
  for (const c of conversationRows) convUser.set(c.id, c.user_id)

  // Per-user aggregates, built in a single pass per source table.
  const lastActive = new Map<string, string>() // userId -> max message created_at
  const userMsgCount = new Map<string, number>()
  for (const m of messageRows) {
    const userId = convUser.get(m.conversation_id)
    if (!userId) continue
    if (m.role === "user") userMsgCount.set(userId, (userMsgCount.get(userId) ?? 0) + 1)
    const prev = lastActive.get(userId)
    if (!prev || m.created_at > prev) lastActive.set(userId, m.created_at)
  }

  const noteCount = new Map<string, number>()
  const incompleteCount = new Map<string, number>()
  for (const n of vaultNoteRows) {
    noteCount.set(n.user_id, (noteCount.get(n.user_id) ?? 0) + 1)
    if (n.content_md?.includes("incomplete: true")) {
      incompleteCount.set(n.user_id, (incompleteCount.get(n.user_id) ?? 0) + 1)
    }
  }

  const openIntents = new Map<string, number>()
  for (const i of intentRows) {
    if (i.status === "open") openIntents.set(i.user_id, (openIntents.get(i.user_id) ?? 0) + 1)
  }

  const rows = profileRows
    .map((p) => {
      const notes = noteCount.get(p.id) ?? 0
      const incomplete = incompleteCount.get(p.id) ?? 0
      return {
        ...p,
        lastActive: lastActive.get(p.id) ?? null,
        userMsgs: userMsgCount.get(p.id) ?? 0,
        notes,
        openIntents: openIntents.get(p.id) ?? 0,
        incompletePct: notes ? Math.round((100 * incomplete) / notes) : 0,
      }
    })
    .sort((a, b) => {
      if (!a.lastActive && !b.lastActive) return 0
      if (!a.lastActive) return 1
      if (!b.lastActive) return -1
      return b.lastActive.localeCompare(a.lastActive)
    })

  const totalUsers = profileRows.length
  const onboardedPct = totalUsers ? Math.round((100 * profileRows.filter((p) => p.onboarded).length) / totalUsers) : 0
  const notesLast7d = vaultNoteRows.filter((n) => n.created_at >= sevenDaysAgoIso).length

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label="Total users" value={totalUsers} />
        <Tile label="% onboarded" value={`${onboardedPct}%`} />
        <Tile label="Notes created (7d)" value={notesLast7d} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Users</h2>
        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Joined</th>
                <th className="px-3 py-2">Onboarded</th>
                <th className="px-3 py-2">Last active</th>
                <th className="px-3 py-2">User msgs</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Open intents</th>
                <th className="px-3 py-2">Incomplete %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-800">
                  <td className="px-3 py-2">{r.email ?? r.display_name ?? r.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.onboarded ? "✓" : "—"}</td>
                  <td className="px-3 py-2">{relativeTime(r.lastActive)}</td>
                  <td className="px-3 py-2">{r.userMsgs}</td>
                  <td className="px-3 py-2">{r.notes}</td>
                  <td className="px-3 py-2">{r.openIntents}</td>
                  <td className="px-3 py-2">{r.incompletePct}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="px-3 py-4 text-neutral-500" colSpan={8}>No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Events (last 50)</h2>
        <div className="flex gap-4 mb-3">
          <Tile label="AI fallbacks (7d)" value={fallbackCount ?? 0} />
          <Tile label="AI failures (7d)" value={failureCount ?? 0} />
        </div>
        <div className="overflow-x-auto border border-neutral-800 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-900 text-neutral-400">
              <tr>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {eventRows.map((e, i) => {
                const detailStr = JSON.stringify(e.detail ?? {})
                return (
                  <tr key={i} className="border-t border-neutral-800">
                    <td className="px-3 py-2">{e.kind}</td>
                    <td className="px-3 py-2">{e.user_id ? e.user_id.slice(0, 8) : "—"}</td>
                    <td className="px-3 py-2">{relativeTime(e.created_at)}</td>
                    <td className="px-3 py-2 text-neutral-400">{detailStr.length > 120 ? `${detailStr.slice(0, 120)}…` : detailStr}</td>
                  </tr>
                )
              })}
              {eventRows.length === 0 && (
                <tr><td className="px-3 py-4 text-neutral-500" colSpan={4}>No events yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50">
      <div className="text-xs text-neutral-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PALETTE_MODES, BACKGROUNDS, type GraphSettings } from "@/lib/graph/palettes"

interface InitialProfile {
  display_name: string | null
  base_profile: { age?: number; home_location?: string; gender?: string }
}

const GENDER_OPTIONS = ["", "Female", "Male", "Non-binary", "Other", "Prefer not to say"]

const ENTITY_TYPES = ["item", "brand", "place", "person", "event", "org", "interest"]

interface VaultNode {
  id: string
  title: string
  path: string
  entity_type: string | null
  source: string | null
  content_md: string | null
}

interface Props {
  userId: string
  initialProfile: InitialProfile
  onNodeDeleted: () => void
  settings: GraphSettings
  onSettingsChange: (s: GraphSettings) => void
}

export default function UserMenu({ userId, initialProfile, onNodeDeleted, settings, onSettingsChange }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"root" | "profile" | "nodes" | "graph">("root")

  const [displayName, setDisplayName] = useState(initialProfile.display_name ?? "")
  const [age, setAge] = useState(initialProfile.base_profile?.age?.toString() ?? "")
  const [home, setHome] = useState(initialProfile.base_profile?.home_location ?? "")
  const [gender, setGender] = useState(initialProfile.base_profile?.gender ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const initial = (displayName || "?").trim().charAt(0).toUpperCase()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  async function saveProfile() {
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    const parsedAge = age.trim() ? Number(age) : undefined
    await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        base_profile: {
          ...(parsedAge !== undefined && !Number.isNaN(parsedAge) ? { age: parsedAge } : {}),
          ...(home.trim() ? { home_location: home.trim() } : {}),
          ...(gender ? { gender } : {}),
        },
      })
      .eq("id", userId)
    setSaving(false)
    setSaved(true)
    router.refresh()
  }

  // Manage-nodes state
  const [nodes, setNodes] = useState<VaultNode[] | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<VaultNode | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Load the vault list when the Manage-nodes view opens (RLS scopes to this user).
  useEffect(() => {
    if (view !== "nodes" || nodes !== null) return
    const supabase = createClient()
    supabase
      .from("vault_notes")
      .select("id, title, path, entity_type, source, content_md")
      .neq("path", "_profile.md") // hide the root anchor
      .order("created_at", { ascending: false })
      .then(({ data }) => setNodes((data as VaultNode[]) ?? []))
  }, [view, nodes])

  async function deleteNode(node: VaultNode) {
    const supabase = createClient()
    const { count } = await supabase
      .from("vault_links")
      .select("id", { count: "exact", head: true })
      .or(`source_note_id.eq.${node.id},target_note_id.eq.${node.id}`)
    const msg = `Delete "${node.title}"?${count ? ` This removes ${count} connection${count === 1 ? "" : "s"}.` : ""}`
    if (!window.confirm(msg)) return
    setDeleting(true)
    await supabase.from("vault_notes").delete().eq("id", node.id) // edges cascade at the DB level
    setDeleting(false)
    setNodes((prev) => prev?.filter((n) => n.id !== node.id) ?? null)
    setSelected(null)
    onNodeDeleted() // nudge the canvas to drop the node
  }

  const visibleNodes = (nodes ?? []).filter(
    (n) =>
      (!filter || n.entity_type === filter) &&
      (!search.trim() || n.title.toLowerCase().includes(search.trim().toLowerCase())),
  )

  return (
    <>
      {/* Avatar chip — top-right, ghosted until hover */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed top-4 right-4 z-40 h-9 w-9 rounded-full bg-white/10 border border-white/15 text-sm font-medium text-white/60 opacity-50 hover:opacity-100 hover:bg-white/15 transition-all flex items-center justify-center backdrop-blur-md"
      >
        {initial}
      </button>

      {open && (
        <>
          {/* Click-outside scrim */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Slide-over drawer */}
          <div className="fixed top-0 right-0 z-50 h-full w-full sm:w-[380px] bg-black/80 backdrop-blur-xl border-l border-white/10 flex flex-col text-white">
            <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
              {view !== "root" ? (
                <button
                  onClick={() => {
                    if (selected) setSelected(null)
                    else { setView("root"); setSaved(false) }
                  }}
                  aria-label="Back"
                  className="text-white/50 hover:text-white transition-colors -ml-1"
                >
                  ←
                </button>
              ) : (
                <div className="h-9 w-9 rounded-full bg-white/10 border border-white/15 text-sm font-medium text-white/70 flex items-center justify-center">
                  {initial}
                </div>
              )}
              <span className="text-sm font-medium truncate">
                {view === "profile"
                  ? "Profile"
                  : view === "graph"
                    ? "Graph settings"
                    : view === "nodes"
                      ? selected?.title ?? "Manage nodes"
                      : displayName.trim() || "Your account"}
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="ml-auto text-white/40 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {view === "root" && (
              <div className="p-2">
                <MenuRow label="Profile" onClick={() => setView("profile")} />
                <MenuRow label="Graph settings" onClick={() => setView("graph")} />
                <MenuRow label="Manage nodes" onClick={() => setView("nodes")} />
                <a
                  href="/api/vault/export"
                  className="block w-full text-left px-3 py-2.5 rounded-lg text-sm text-white/80 transition-colors hover:bg-white/10"
                >
                  Export vault
                </a>
                <MenuRow label="Logout" onClick={handleLogout} danger />
                {/* ponytail: placeholder — wired up with privacy/deletion flow pre-deploy */}
                <button
                  disabled
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-white/25 cursor-not-allowed"
                >
                  Delete account
                </button>
              </div>
            )}

            {view === "profile" && (
              <div className="p-5 space-y-4">
                <Field label="Display name" value={displayName} onChange={setDisplayName} placeholder="Your name" />
                <Field label="Age" value={age} onChange={setAge} placeholder="—" type="number" />
                <Field label="Home location" value={home} onChange={setHome} placeholder="City" />
                <label className="block">
                  <span className="text-xs text-white/40">Gender</span>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                  >
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g} className="bg-neutral-900">
                        {g || "—"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="w-full bg-white text-black rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-white/90 disabled:opacity-50 transition-colors mt-2"
                >
                  {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
                </button>
              </div>
            )}

            {view === "graph" && (
              <div className="p-5 space-y-6">
                <div>
                  <span className="text-xs text-white/40">Palette</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {PALETTE_MODES.map((m) => (
                      <button
                        key={m}
                        onClick={() => onSettingsChange({ ...settings, palette: m })}
                        className={`px-3 py-2 rounded-lg text-sm capitalize border transition-colors ${
                          settings.palette === m
                            ? "bg-white text-black border-white"
                            : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-white/40">Background</span>
                  <div className="mt-2 flex gap-2.5">
                    {BACKGROUNDS.map((b) => (
                      <button
                        key={b.value}
                        onClick={() => onSettingsChange({ ...settings, background: b.value })}
                        title={b.name}
                        aria-label={b.name}
                        style={{ background: b.value }}
                        className={`h-9 w-9 rounded-full border-2 transition-all ${
                          settings.background === b.value ? "border-white scale-110" : "border-white/15 hover:border-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-white/25">Changes apply live and are saved on this device.</p>
              </div>
            )}

            {view === "nodes" && !selected && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="p-4 space-y-3 border-b border-white/10">
                  <input
                    value={search}
                    placeholder="Search nodes…"
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <Chip label="all" active={!filter} onClick={() => setFilter(null)} />
                    {ENTITY_TYPES.map((t) => (
                      <Chip key={t} label={t} active={filter === t} onClick={() => setFilter(filter === t ? null : t)} />
                    ))}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                  {nodes === null ? (
                    <p className="text-white/30 text-sm px-3 py-4">Loading…</p>
                  ) : visibleNodes.length === 0 ? (
                    <p className="text-white/30 text-sm px-3 py-4">No nodes yet.</p>
                  ) : (
                    visibleNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => setSelected(n)}
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-2"
                      >
                        <span className="text-sm text-white/80 truncate flex-1">{n.title}</span>
                        {n.entity_type && <span className="text-[10px] text-white/40 uppercase tracking-wide">{n.entity_type}</span>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {view === "nodes" && selected && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="overflow-y-auto flex-1 p-5">
                  <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                    {selected.content_md || "(empty note)"}
                  </pre>
                </div>
                <div className="p-4 border-t border-white/10">
                  {selected.source === "system" ? (
                    <p className="text-xs text-white/30">System node — can’t be deleted (other nodes depend on it).</p>
                  ) : (
                    <button
                      onClick={() => deleteNode(selected)}
                      disabled={deleting}
                      className="w-full text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/50 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Deleting…" : "Delete node"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
        active ? "bg-white text-black" : "bg-white/5 text-white/50 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  )
}

function MenuRow({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-white/10 ${
        danger ? "text-red-400 hover:text-red-300" : "text-white/80"
      }`}
    >
      {label}
    </button>
  )
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-white/40">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors"
      />
    </label>
  )
}

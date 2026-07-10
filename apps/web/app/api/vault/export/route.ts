import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import JSZip from "jszip"

// Exports the user's vault as a .zip of markdown files at their real paths —
// a drop-in Obsidian vault (frontmatter + [[wikilinks]] preserved). RLS scopes
// the read to the caller; no admin client.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { data: notes, error } = await supabase
    .from("vault_notes")
    .select("path, content_md")
    .is("archived_at", null) // gardener-archived nodes are soft-deleted, not part of the exported vault
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const zip = new JSZip()
  for (const n of notes ?? []) {
    const path = n.path.endsWith(".md") ? n.path : `${n.path}.md`
    zip.file(path, n.content_md ?? "")
  }
  const blob = await zip.generateAsync({ type: "uint8array" })

  return new NextResponse(blob as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="hype-vault.zip"`,
    },
  })
}

// apps/web/app/api/waitlist/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

// Public endpoint (no auth — visitors aren't logged in). Admin client because the
// waitlist table has RLS with no policies (same pattern as scout_cache).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 })
  }
  const admin = createAdminClient()
  // ponytail: duplicate signups return ok:true on purpose — "already on the list" is success.
  const { error } = await admin
    .from("waitlist")
    .upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

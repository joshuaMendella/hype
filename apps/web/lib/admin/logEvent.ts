import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

// Fire-and-forget observability. NEVER awaited in a hot path, never throws into the caller.
export function logEvent(kind: string, detail: Record<string, unknown> = {}, userId?: string | null) {
  void createAdminClient()
    .from("events")
    .insert({ kind, detail, user_id: userId ?? null })
    .then(({ error }) => { if (error) console.error("[logEvent] failed:", kind, error.message) })
}

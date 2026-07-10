/**
 * On-command Gardener trigger (v1) — dry-run only, human-readable inspect view.
 * Looks up the single owner user, runs reconcileGraph in dry-run mode, and
 * pretty-prints each proposed op with node titles resolved (ids alone aren't
 * readable) so a human can decide whether to trust the pass.
 *
 * Deviation from the plan: this replaces the plan's owner-gated
 * POST /api/graph/reconcile route for v1 — a script is the laziest sufficient
 * on-command trigger, and the future cron will call reconcileGraph directly
 * (same core fn either way). The API route can be added later without
 * touching reconcile.ts.
 *
 * Run (from apps/web):
 *   NODE_OPTIONS="--conditions=react-server" pnpm dlx tsx scripts/reconcile.ts
 * (the react-server condition is needed because reconcile.ts transitively
 * imports "server-only" via lib/admin/logEvent.ts and lib/supabase/admin.ts —
 * same as the other scripts/self-checks in this repo.)
 *
 * Needs in apps/web/.env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * and GEMINI_API_KEY (or CEREBRAS_API_KEY as fallback).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// load env BEFORE importing reconcile.ts / admin.ts — they read process.env at module load
for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

async function main() {
  const { createAdminClient } = await import("../lib/supabase/admin")
  const { reconcileGraph } = await import("../lib/graph/reconcile")

  const supabase = createAdminClient()

  // ponytail: single-user product right now — grab the one profiles row rather than
  // building a user-picker. Revisit if/when there's more than one real user.
  const { data: profile, error } = await supabase.from("profiles").select("id, display_name, email").limit(1).single()
  if (error || !profile) {
    console.error("No profiles row found — nothing to reconcile.", error?.message ?? "")
    process.exit(1)
  }
  console.log(`Reconciling graph for ${profile.display_name ?? profile.email ?? profile.id} (${profile.id})...\n`)

  const { data: notes } = await supabase.from("vault_notes").select("id, title").eq("user_id", profile.id)
  const titleById = new Map((notes ?? []).map((n) => [n.id as string, n.title as string]))
  const name = (id: string) => `"${titleById.get(id) ?? id}"`

  // Pass --apply to actually mutate the vault (soft + logged + reversible); default is dry run.
  const dryRun = !process.argv.includes("--apply")
  const { ops, applied } = await reconcileGraph(profile.id, { dryRun })

  if (!ops.length) {
    console.log("No ops proposed — graph looks clean.")
    return
  }
  console.log(`${ops.length} op(s) — ${dryRun ? "DRY RUN, nothing applied" : `APPLIED ${applied}/${ops.length}`}:\n`)
  for (const op of ops) {
    const conf = `(confidence ${op.confidence.toFixed(2)})`
    if (op.op === "merge") console.log(`  MERGE     ${name(op.from_id)} -> ${name(op.into_id)}  ${conf} — ${op.reason}`)
    else if (op.op === "retype") console.log(`  RETYPE    ${name(op.id)} -> ${op.entity_type}  ${conf} — ${op.reason}`)
    else if (op.op === "add_edge") console.log(`  ADD_EDGE  ${name(op.from_id)} -${op.label}-> ${name(op.to_id)}  ${conf} — ${op.reason}`)
    else if (op.op === "drop") console.log(`  DROP      ${name(op.id)}  ${conf} — ${op.reason}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })

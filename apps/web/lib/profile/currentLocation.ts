// Single source of truth for how long a current_location is trusted. Shared by
// scout (lib/scout/getScoutFind.ts, server) and the graph identity rule
// (components/graph/GraphWrapper.tsx, client) — keep them agreeing.
export const CURRENT_LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Fresh = has a timestamp within the TTL. No timestamp (legacy rows) = stale,
// matching scout's existing behavior (its currentFresh check requires current_location_at).
export const isCurrentLocationFresh = (at?: string | null): boolean =>
  !!at && Date.now() - new Date(at).getTime() < CURRENT_LOC_TTL_MS

// ponytail: one runnable check — `npx tsx lib/profile/currentLocation.ts` from apps/web.
if (process.argv[1] && process.argv[1].endsWith("currentLocation.ts")) {
  const assert = (c: boolean, m: string) => { if (!c) { console.error("FAIL:", m); process.exit(1) } }
  assert(isCurrentLocationFresh(new Date().toISOString()), "just-now timestamp is fresh")
  assert(isCurrentLocationFresh(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString()), "29 days old is fresh")
  assert(!isCurrentLocationFresh(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString()), "31 days old is stale")
  assert(!isCurrentLocationFresh(undefined), "missing timestamp is stale")
  assert(!isCurrentLocationFresh(null), "null timestamp is stale")
  console.log("currentLocation.ts self-check OK")
}

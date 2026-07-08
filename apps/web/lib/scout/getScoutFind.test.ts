import assert from "node:assert"

// ponytail: minimal framework-free check for the current_location-vs-home_location
// freshness logic in getScoutFind.ts (mirrored here, not imported, since the real
// function needs a live Supabase admin client). Run: npx tsx lib/scout/getScoutFind.test.ts
const CURRENT_LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000

function effectiveCity(profile: { home_location?: string; current_location?: string; current_location_at?: string }): string | undefined {
  const currentFresh =
    profile.current_location?.trim() &&
    profile.current_location_at &&
    Date.now() - new Date(profile.current_location_at).getTime() < CURRENT_LOC_TTL_MS
  return (currentFresh ? profile.current_location : profile.home_location)?.trim()
}

// Fresh current_location (1 day old) wins over home_location.
const fresh = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
assert.strictEqual(
  effectiveCity({ home_location: "Rzeszów", current_location: "Lisbon", current_location_at: fresh }),
  "Lisbon"
)

// Stale current_location (40 days old) falls back to home_location.
const stale = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
assert.strictEqual(
  effectiveCity({ home_location: "Rzeszów", current_location: "Lisbon", current_location_at: stale }),
  "Rzeszów"
)

console.log("getScoutFind.test.ts self-check OK")

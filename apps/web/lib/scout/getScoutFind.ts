import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchCityEvents, fetchArtistTours, type ScoutFind } from "./sources"

// Scout Digest v1 — picks at most one "welcome back" find for the opener.
// Owns: the >48h gap dedupe guard (reusing the same threshold the caller uses to
// decide whether this is a welcome-back opener at all), the scout_cache read/write
// (admin client — table has no RLS, never touched from the browser), and calling
// the source APIs in parallel on a cache miss. See docs/scout/2026-07-08-scout-digest-plan.md.
const GAP_MS = 48 * 60 * 60 * 1000
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
// A "current location" is only trusted for 30 days — past that it's likely stale
// (user moved on / trip ended) and we fall back to home_location instead.
const CURRENT_LOC_TTL_MS = 30 * 24 * 60 * 60 * 1000

type ScoutProfile = { home_location?: string; current_location?: string; current_location_at?: string; last_scout_shown_at?: string }
type ScoutEntity = { title: string; entity_type: string | null }

function citySlug(city: string): string {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

async function readCache(admin: ReturnType<typeof createAdminClient>, cacheKey: string): Promise<ScoutFind[] | null> {
  const { data } = await admin
    .from("scout_cache")
    .select("payload, expires_at")
    .eq("cache_key", cacheKey)
    .single()
  if (!data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return data.payload as ScoutFind[]
}

async function writeCache(admin: ReturnType<typeof createAdminClient>, cacheKey: string, payload: ScoutFind[]) {
  await admin.from("scout_cache").upsert(
    { cache_key: cacheKey, payload, fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString() },
    { onConflict: "cache_key" }
  )
}

export async function getScoutFind(
  userId: string,
  profile: ScoutProfile,
  entities: ScoutEntity[]
): Promise<ScoutFind | null> {
  // Dedupe guard: don't re-open with a find if the user was already shown one within
  // the gap window (the outer >48h-since-last-visit check already gates the call site;
  // this covers the case where a find was shown very recently for another reason).
  if (profile.last_scout_shown_at && Date.now() - new Date(profile.last_scout_shown_at).getTime() < GAP_MS) {
    return null
  }

  const admin = createAdminClient()
  const today = new Date().toISOString().split("T")[0]
  // Prefer current_location while fresh (within TTL) — that's where the user actually
  // is right now — else fall back to home_location. A stale current_location is never used.
  const currentFresh =
    profile.current_location?.trim() &&
    profile.current_location_at &&
    Date.now() - new Date(profile.current_location_at).getTime() < CURRENT_LOC_TTL_MS
  const city = (currentFresh ? profile.current_location : profile.home_location)?.trim()
  const artistNames = entities
    .filter((e) => e.entity_type === "person" || e.entity_type === "interest")
    .map((e) => e.title)
    .slice(0, 3)

  if (!city && !artistNames.length) return null

  const finds: ScoutFind[] = []

  if (city) {
    const cacheKey = `events:${citySlug(city)}:${today}`
    let cityFinds = await readCache(admin, cacheKey)
    if (cityFinds === null) {
      cityFinds = await fetchCityEvents(city)
      await writeCache(admin, cacheKey, cityFinds)
    }
    finds.push(...cityFinds)
  }

  if (artistNames.length) {
    const cacheKey = `artist:${artistNames.map(citySlug).sort().join(",")}`
    let artistFinds = await readCache(admin, cacheKey)
    if (artistFinds === null) {
      artistFinds = await fetchArtistTours(artistNames)
      await writeCache(admin, cacheKey, artistFinds)
    }
    finds.push(...artistFinds)
  }

  if (!finds.length) return null

  // Best find: earliest upcoming date wins (soonest is most actionable).
  const best = [...finds].sort((a, b) => a.date.localeCompare(b.date))[0]

  await admin.from("profiles").update({
    base_profile: { ...profile, last_scout_shown_at: new Date().toISOString() },
  }).eq("id", userId)

  return best
}

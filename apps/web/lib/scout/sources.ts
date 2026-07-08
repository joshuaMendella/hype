import "server-only"

// Scout Digest v1 sources — Ticketmaster Discovery (city events) + Bandsintown
// (artist tours). Both are free-tier, server-only, best-effort: missing key,
// network error, or timeout all resolve to [] so the opener degrades silently
// to today's behavior (see docs/scout/2026-07-08-scout-digest-plan.md §4/§6).

export type ScoutFind = { id: string; title: string; date: string; venue: string; url: string; source: string }

const TIMEOUT_MS = 1500

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok ? res : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchCityEvents(city: string): Promise<ScoutFind[]> {
  const key = process.env.SCOUT_TICKETMASTER_KEY
  if (!key || !city) return []

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&city=${encodeURIComponent(city)}&size=5&sort=date,asc`
    const res = await fetchWithTimeout(url)
    if (!res) return []
    const data = await res.json()
    const events = data?._embedded?.events ?? []
    return events.map((e: Record<string, unknown>): ScoutFind => {
      const dates = e.dates as { start?: { localDate?: string } } | undefined
      const embedded = e._embedded as { venues?: Array<{ name?: string }> } | undefined
      return {
        id: String(e.id ?? e.name),
        title: String(e.name ?? "Event"),
        date: dates?.start?.localDate ?? "",
        venue: embedded?.venues?.[0]?.name ?? city,
        url: String(e.url ?? ""),
        source: "Ticketmaster",
      }
    })
  } catch {
    return []
  }
}

export async function fetchArtistTours(names: string[]): Promise<ScoutFind[]> {
  const appId = process.env.SCOUT_BANDSINTOWN_APP_ID
  if (!appId || !names.length) return []

  const results = await Promise.all(
    names.map(async (name): Promise<ScoutFind[]> => {
      try {
        const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(name)}/events?app_id=${appId}&date=upcoming`
        const res = await fetchWithTimeout(url)
        if (!res) return []
        const events = await res.json()
        if (!Array.isArray(events)) return []
        return events.map((e: Record<string, unknown>): ScoutFind => {
          const venue = e.venue as { name?: string; city?: string } | undefined
          return {
            id: String(e.id ?? `${name}-${e.datetime}`),
            title: `${name} live`,
            date: String(e.datetime ?? "").split("T")[0] ?? "",
            venue: venue?.name ? `${venue.name}${venue.city ? `, ${venue.city}` : ""}` : "TBA",
            url: String(e.url ?? ""),
            source: "Bandsintown",
          }
        })
      } catch {
        return []
      }
    })
  )

  return results.flat()
}

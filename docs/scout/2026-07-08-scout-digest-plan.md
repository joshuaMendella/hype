# Scout Digest — v1 Build Plan (in-app welcome-back)

**Status:** planned (Opus). Ready for Sonnet execution when the owner says go.
**Date:** 2026-07-08
**Pipeline:** Fable brainstorm ✓ → API survey ✓ → this plan (Opus) → Sonnet build.

---

## 1. Goal (one line)
Give something back to the user *before* advertisers arrive: when they open the app, the AI can open with a **real, current, local find** (a concert/event in their city, a tour by an artist they follow) pulled live from a free API — never invented.

## 2. Scope — what v1 is and is NOT
**v1 = L0 in-app welcome-back.**
- Web only. Delivered **in chat**, as the opener line + a structured card. No push, no email.
- **No cron, no Vercel deploy dependency** — it runs inside the existing opener request path.
- Triggered **when the user opens the app** after being away (see trigger below). Not real-time, not a background job.

**Explicitly deferred (do NOT build now):**
- Products / price-watch (Amazon PA-API sales-gate + Keepa cost) → L2.
- Push notifications (net-new `expo-notifications` work, not wired) → later.
- Interest digests (TMDB/RAWG/TheSportsDB) → L3, after events proves out.
- Any paid placement inside a digest → business bright line, never.

## 3. The one architectural decision
**Build scout as a generalization of the existing ad-card flow, not a parallel system.** The pieces already exist in draft:
- `app/api/chat/route.ts` opener already injects a `todayContext` block ("Scheduled for today… open with one of these") into the system prompt → **a `scoutContext` block is the same shape.**
- `components/chat/ChatPanel.tsx` already renders `{ reply, card }` and shows `AdCardView` mid-screen → **the scout find rides in that same card slot.**
- The ad flow's structured card (sponsor/title/price/url) → **scout card = source/title/date/venue/url.** Same component, light variant or shared.

So Sonnet's first task is to make the ad card generic enough to also carry a scout find, then wire the scout as a new *source* of cards.

## 4. Anti-hallucination rule (non-negotiable)
**Select, don't generate.** The LLM never writes a date, venue, or URL. It only writes the conversational wrapper ("There's something in Rzeszów this weekend you might like —"). The facts (title/date/venue/link) come from the API record verbatim and ride in the **card**, which the rendering layer fills from structured data. Feed the find into `scoutContext` as reference-only, with an explicit "quote these fields exactly, do not alter or invent" instruction.

## 5. Data model
- **No new last-visit column.** Derive "time since last visit" from the most recent `conversations.updated_at` (already read in the opener for the 2h session logic; there's an `updated_at` trigger). Trigger scout when gap **> 48h**.
- **New table `scout_cache`** — city-level cache so cost scales with distinct cities/day, not users:
  ```sql
  CREATE TABLE IF NOT EXISTS public.scout_cache (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_key   TEXT NOT NULL,          -- e.g. "events:rzeszow:2026-07-08" or "artist:radiohead"
    payload     JSONB NOT NULL,         -- normalized find records (id,title,date,venue,url,source)
    fetched_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ NOT NULL,
    UNIQUE(cache_key)
  );
  ```
  Not user-scoped, so **no RLS / read via admin client in the API route only.** Never expose to the browser. Add via ALTER-migration pattern (schema.sql is already partially stale — append there + apply on live DB).
- **De-dupe surfaced finds** so the same event isn't offered twice: reuse the `intents` table pattern, or add a tiny `scout_shown (user_id, find_id, shown_at)` guard. Ponytail: start by just not re-opening with a find if the user already saw one in the last N days; add per-find dedupe only if repeats show up in testing.

## 6. APIs — v1
| Source | Use | Cost | Notes |
|--------|-----|------|-------|
| **Ticketmaster Discovery** | events in home city | free | thin Poland coverage — expect gaps for Rzeszów; that's fine, empty = send nothing |
| **Bandsintown** | tours by artists the user follows (`interest`/`person` entities) | free | needs app_id; artist name → upcoming shows |

**Empty-find rule:** if neither API returns a relevant record, **the scout injects nothing** and the opener behaves exactly as it does today. Never pad, never fabricate.

Both keys are **server-side only** (`SCOUT_TICKETMASTER_KEY`, `SCOUT_BANDSINTOWN_APP_ID` in `.env.local`, no `NEXT_PUBLIC_`), called only from the API route.

## 7. Consent & business bright line
- **Already disclosed:** onboarding Step 3 tells the user the AI will "surface stuff that's relevant to you." So proactive surfacing is in the data contract.
- The digest itself is **info-only and non-commercial** — no affiliate/paid link inside the find. Per-moment consent still applies at any *commerce* step, exactly as the existing ad flow ("want me to pull up tickets?" → yes/no).
- **No new consent toggle or settings row** (violates the per-moment consent principle in BUSINESS.md).

## 8. Flow (opener request, welcome-back path)
1. Opener fires (`messages.length === 0`), route loads profile + vault as today.
2. If `now - lastConversation.updated_at > 48h` **and** user has a `home_location` and/or followed artists:
   a. Build cache keys; **check `scout_cache`** (admin client).
   b. Cache hit → use payload. Cache miss → fetch Ticketmaster/Bandsintown **in parallel with the other opener work, with a tight timeout (~1.5s)**; on timeout, skip scout this time (open normally). Write result (or empty) to cache with `expires_at`.
   c. If a relevant find exists, inject a `scoutContext` block into the system prompt AND set the return `card` to the find. LLM opens with the wrapper line; card shows verbatim facts + real URL.
3. No find / timeout / gap ≤ 48h → today's behavior, untouched.
4. **Extraction:** unlike ad turns (which are excluded via `isAdFlowMessage`), let the user's *reply* to a scout find flow into `synthesize()` — "yeah I saw them live once" enriches the graph. Only the scout-injected assistant line is scripted; the reply is normal.

## 9. Build order for Sonnet
1. **Generalize the card:** make `AdCard`/`AdCardView` carry either an ad or a scout find (discriminated by a `kind` field), or extract a shared `OfferCard`. Keep it minimal — same visual, extra fields.
2. **`lib/scout/sources.ts`:** two functions, `fetchCityEvents(city)` and `fetchArtistTours(names)`, each returning normalized `{id,title,date,venue,url,source}[]`. Server-only. Timeout + graceful empty on error.
3. **`scout_cache` migration** (schema.sql + apply on live DB via MCP).
4. **`lib/scout/getScoutFind.ts`:** given userId + profile + vault entities, checks cache → fetches → returns at most one best find (or null). Owns the 48h gap check and the dedupe guard.
5. **Wire into `app/api/chat/route.ts` opener:** call `getScoutFind` in parallel; inject `scoutContext`; return `card`. Guard so it only runs on the welcome-back opener, never mid-conversation.
6. **Verify** (see below) before confirming.

## 10. Verification (before saying "done")
- `pnpm build` green.
- Manual: `/hype-reset`, seed a `home_location` (Rzeszów) + one followed artist, force `updated_at` back >48h, open app → confirm: find appears in opener + card, facts match the API JSON exactly, link is real. Then with no matches → confirm opener is unchanged and no card.
- Confirm no scout key has a `NEXT_PUBLIC_` prefix and `scout_cache` is never queried from a browser client.
- Confirm the second opener within 48h shows **no** scout find (gap guard) and cache is a hit (no duplicate API call).

## 11. Open questions for the owner (small; defaults chosen)
- **48h gap** is the default welcome-back threshold — tune later.
- **v1 = events only.** Products come at L2 once PA-API sales gate + Keepa cost are worth it. State it, don't ask.
- Bandsintown needs an `app_id` (free registration) and Ticketmaster a free API key — owner to register both when we start building.

# Onboarding Redesign — Design Spec

**Date:** 2026-07-12
**Status:** Approved design, ready for implementation plan
**Supersedes:** the LLM-scripted onboarding in `app/api/chat/route.ts` (and the interim degeneration patch on that path)

## Problem

Today a new user (`profiles.onboarded === false`) lands on `/graph` and sees an
**empty-feeling canvas** (only the auto-seeded "You" node) while a 5-step canned
script runs *through an LLM* inside the chat panel. Two failures:

1. **It tells, doesn't show.** The script *describes* the graph growing, but nothing
   visually happens — extraction is skipped during onboarding, so the first real node
   only appears after the whole script + the user's first free answer.
2. **It's fragile.** Forcing Gemini to parrot fixed lines as JSON at `temperature 0.8`
   triggers a newline-flood loop that blows `maxOutputTokens` and yields unterminated
   JSON (the "Gemini degeneration" bug). An interim fix exists (temp-0 + Cerebras retry),
   but the root cause is *using an LLM to read a script at all*.

## Goal

A captivating, trustworthy first run that **shows the graph grow from the user's own
answers** and makes the data/consent contract unmistakable — without a form or a legal
wall. Balanced "aha + trust" (owner decision).

## The flow (7 beats)

Beats 1–6 are **deterministic, app-rendered** (no LLM). Beat 7 is the real interviewer
taking over. Each beat is one chat bubble; the user taps/replies to advance.

| Beat | Kind | Copy |
|---|---|---|
| 1 Welcome | canned | "Hey [name]. Good to have you here." |
| 2 How-to | canned | "There's nothing to set up. We just talk — a little each day, whatever's on your mind — and I remember." |
| 3 Value + consent | canned + **example card** | "One thing before we start: as I get to know you, I'll sometimes spot something *hyper-tailored* to you. I'll only ever bring it up if you say yes — like this:" |
| 3 Example card | translucent preview of the assistant's **ask**, ghosted `Yes / Not now` beneath | "Hey — those running shoes you'd been eyeing just dropped in price. Want me to pull it up?" |
| 4 Where | canned question → **seeds Location node** | "Okay — easy one first. Where do you call home these days?" |
| 5 Work/study | canned question → **seeds Work/Study node** | "And what fills your days — do you study, work, a bit of both?" |
| 6 Confirm growth | canned, fired a beat *after* nodes animate in | "Look at your graph — those just appeared, and they're linked to you. That canvas is yours now, and it grows every time we talk." |
| 7 Handoff | **live interviewer** (`/api/chat`) | generated from the seeded facts, e.g. "So you're in [city] — how'd you end up there?" |

Copy source: Fable draft, 2026-07-12. `[name]` = `profiles.display_name`.

### The example card (beat 3)

A **static, translucent** card — NOT the real ad card (that redesign is deferred). It
previews *what the assistant might ask*, demonstrating the per-moment consent mechanic
(notice → ask → you decide) rather than pitching a product. Ghosted, non-functional
`Yes / Not now` affordances underneath make the consent gate visual. Copy is clearly
hypothetical ("those running shoes you'd been eyeing") so it reads as a sample of the
moment, not a real offer. Small dedicated presentational component
(`ExampleConsentCard`), ~20 lines; does not reuse `AdCard`.

## Architecture

### Where onboarding lives: inside `ChatPanel` (an onboarding mode)

Rather than a separate component with a messy in-place handoff, `ChatPanel` gains an
**onboarding mode**, gated on `onboarded === false`:

- Beats 1–6 render as normal chat bubbles pushed into ChatPanel's existing `history`
  state — **no `/api/chat` call**. Advance on tap/reply.
- Beats 4–5: on the user's answer, seed a node (below), lift `identityPlaces`, bump the
  graph `refreshTrigger`.
- After beat 6: flip `profiles.onboarded = true` (client write), then ChatPanel
  **continues in normal interview mode in place** — the user's next input goes to
  `/api/chat` with the accumulated onboarding history in context. The interviewer, now
  seeing `home_location` + the two seeded nodes in the vault, produces beat 7 naturally.
  (So beat 7 is the *real* interviewer, not a canned line — warmer and context-aware.)

This keeps one component owning the whole conversation surface (bubbles, input, cards,
history) and makes the onboarding→interview transition a state change, not a remount.

### Node seeding (deterministic — the "aha")

Seeded client-side via the browser Supabase client (RLS: user owns the rows; established
pattern — `UserMenu` already writes `base_profile` and deletes notes this way). Helper:
`lib/onboarding/seed.ts`.

**Beat 4 (Location):**
- Upsert `vault_notes` on `(user_id, path)`: `path = place/<slug>.md`, `title = <city>`
  (trimmed answer), `entity_type = "place"`, `topic = "place"`, `source = "system"`,
  minimal `content_md`.
- Update `profiles.base_profile.home_location = <city>` (merge, don't clobber other keys)
  — so the rest of the system knows it (scout, You-linking on reload, and the interviewer
  won't re-ask "where do you live").
- Client updates `identityPlaces` state → the place links to You via GraphCanvas's
  synthetic `self` link (a `place` links to You **only** if its title is in
  `identityPlaces`). This is why `identityPlaces` must be live state, not a static prop.

**Beat 5 (Work/Study):**
- Upsert `vault_notes`: `path = org/<slug>.md`, `entity_type = "org"`, `topic = "work"`,
  `source = "system"`, title via a small heuristic on the answer:
  `/stud|school|uni|college/i → "School"`, else if the answer names something concrete use
  it (trimmed, length-capped), else `"Work"`.
  `// ponytail: 3-branch heuristic; a vague answer ("a bit of both") yields a generic node.`
  `// Ceiling: later extraction/Gardener refines or merges it when they name an employer.`
- `org` is an identity type, so GraphCanvas auto-links it to You via the synthetic `self`
  link on the next refresh — **no `identityPlaces` dependency, no DB link needed**.

No `vault_links` rows are written — both You-edges are the client-computed synthetic
`self` links, avoiding double edges on later reloads.

### Live graph refresh

GraphCanvas re-fetches on `refreshTrigger` with 3s/6.5s delays (tuned for *async*
extraction). Onboarding nodes exist the instant they're written, so those delays add
needless lag before the aha. Implementation should trigger a **prompt** refresh for
onboarding seeds (e.g. an immediate fetch, or a 0-delay trigger) so beat 6 lands right
after the nodes pop. Fable's timing note: beat 6 should fire a half-beat *after* the
nodes animate, so the graph does the talking and the line just confirms.

### Deletions (the permanent bug fix)

Remove from `app/api/chat/route.ts`:
- `ONBOARDING_PROMPT`, `ONBOARDING_SCHEMA`
- the `isOnboarding` branch: onboarding-opener path, the JSON parse/retry block, the
  `onboardingComplete` handling, the server-side `onboarded = true` update
- the interim degeneration patch on this path (temp-0 special-case + Cerebras parse-retry)

`geminiChat`'s `jsonSchema` param becomes unused (nothing else passes a schema on the chat
path) → simplify its signature and drop the `temperature: jsonSchema ? 0 : 0.8` ternary
back to `0.8`. The route no longer has any concept of onboarding.

## Files touched

| File | Change |
|---|---|
| `components/chat/ChatPanel.tsx` | Add onboarding mode: scripted beats, seeding calls, in-place transition to interview. Largest change. |
| `components/chat/ExampleConsentCard.tsx` | **New.** Translucent sample-ask card with ghosted Yes/Not now. |
| `lib/onboarding/script.ts` | **New.** The beat copy (Fable draft) as a constant. |
| `lib/onboarding/seed.ts` | **New.** Client seeding helpers (place + org node, `home_location` merge). |
| `components/graph/GraphWrapper.tsx` | Lift `base_profile`/`identityPlaces` into state; pass a setter to ChatPanel; pass `onboarded` down. |
| `app/(app)/graph/page.tsx` | Pass `onboarded` to GraphWrapper. |
| `app/api/chat/route.ts` | **Net deletion** — remove the onboarding branch/prompt/schema and interim patch; simplify `geminiChat`. |

## Scope

**In:** the 7-beat deterministic flow, client node seeding, live You-linking, deletion of
the LLM onboarding path.

**Deferred (owner, later):** the polished ad/suggestion card redesign — beat 3 uses the
new lightweight `ExampleConsentCard`, which is intentionally minimal.

## Known limitations (accepted)

- **No reload-persistence mid-onboarding.** Onboarding beats aren't persisted to
  `messages` (they don't go through `/api/chat`). A reload before finishing restarts the
  scripted flow from beat 1. Seeded nodes persist and their upserts are idempotent
  (`ON CONFLICT (user_id, path)`), so nothing is lost or duplicated. Acceptable for a
  one-sitting, brand-new-user flow.
- **Work node can be generic** ("Work"/"School") for vague answers; self-heals via later
  extraction/Gardener.

## Verification

- Reset (`/hype-reset`) → load `/graph`: You node breathes alone; beats 1–3 render with
  the example card; ghosted Yes/Not now visible.
- Answer beat 4 (a city) → a Place node pops and links to You; `base_profile.home_location`
  set. Answer beat 5 → an Org node pops and links to You.
- Beat 6 confirm lands after nodes appear. Beat 7: interviewer opens referencing the city
  / work (context-aware), `onboarded === true`.
- Chat route: grep confirms no `ONBOARDING_*` / `isOnboarding` remain; typecheck + build
  pass; a normal (non-onboarding) chat turn still works.

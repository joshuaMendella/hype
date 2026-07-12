# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LLM-scripted 5-step onboarding with a deterministic 7-beat flow that seeds real graph nodes from the user's first answers and hands off to the live interviewer.

**Architecture:** Onboarding becomes a client-driven mode inside `ChatPanel` (no `/api/chat` calls during beats 1–6). Two basic questions seed a Place node and an Org node client-side via the browser Supabase client (RLS, established pattern); both link to the "You" node via GraphCanvas's client-computed synthetic `self` links. After a confirm beat, the flag flips and the real interviewer produces beat 7 from the seeded facts. The old LLM onboarding path in the chat route is deleted — the permanent fix for the Gemini degeneration bug.

**Tech Stack:** Next.js 16 + TypeScript, React client components, Supabase (browser client via RLS), D3 graph. No new dependencies. Inline-style convention (no CSS modules) as used across `components/chat` and `components/graph`.

## Global Constraints

- **No new dependencies.** Reuse existing patterns and libraries only.
- **Browser-client writes** use `createClient()` from `@/lib/supabase/client` (RLS-scoped, user-owned rows only). Never the admin/service-role client in client components. This mirrors `components/menu/UserMenu.tsx`.
- **"You" node** is always `path = "_profile.md"`, `title = "You"`, `topic = "Profile"` — auto-created by a DB trigger on signup. Never create or delete it.
- **You-linking is client-side** in `GraphCanvas.tsx`: `entity_type` in `{person, org, interest}` auto-links to You; an `entity_type === "place"` links to You **only** if its title (lowercased) is in the `identityPlaces` prop. No `vault_links` rows are written by onboarding.
- **Slug convention** (copied from `lib/ai/extract.ts:56`): `s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`.
- **vault_notes upsert** uses `onConflict: "user_id,path"` (idempotent — reruns update the same node).
- **Consent copy rule:** the example card is a *sample of the assistant's ask*, clearly hypothetical, never a real offer. Use the term **"hyper-tailored"** verbatim. Consent is per-moment (assistant asks, user says yes) — never a toggle or settings page.
- **Copy is fixed** (Fable draft, 2026-07-12) — use the exact strings in `lib/onboarding/script.ts`; do not paraphrase.
- **Verification reality:** this repo has no component test runner. Pure logic gets an assert-based `scripts/check-*.ts` (run with `pnpm dlx tsx`), matching existing `scripts/check-vault-context.ts`. UI/flow is verified by typecheck + build + manual drive via `/hype-reset` + `pnpm dev`.
- **Typecheck** command (run from `apps/web`): `pnpm exec tsc --noEmit`. **Build:** `pnpm build`.
- **Reset for manual testing:** invoke the `/hype-reset` skill (wipes vault, resets `onboarded=false`).

---

### Task 1: Onboarding copy constant

**Files:**
- Create: `apps/web/lib/onboarding/script.ts`

**Interfaces:**
- Produces: `onboardingCopy` object with `welcome(name: string): string`, and string fields `howto`, `consentIntro`, `exampleAsk`, `askLocation`, `askWork`, `confirm`.

- [ ] **Step 1: Create the copy module**

```ts
// apps/web/lib/onboarding/script.ts
// Fixed onboarding copy (Fable draft, 2026-07-12). Beats 1–6 are deterministic and
// app-rendered — do not route these through an LLM. Beat 7 is the live interviewer.
export const onboardingCopy = {
  welcome: (name: string) => `Hey ${name}. Good to have you here.`,
  howto:
    "There's nothing to set up. We just talk — a little each day, whatever's on your mind — and I remember.",
  consentIntro:
    "One thing before we start: as I get to know you, I'll sometimes spot something hyper-tailored to you. I'll only ever bring it up if you say yes — like this:",
  exampleAsk:
    "Hey — those running shoes you'd been eyeing just dropped in price. Want me to pull it up?",
  askLocation: "Okay — easy one first. Where do you call home these days?",
  askWork: "And what fills your days — do you study, work, a bit of both?",
  confirm:
    "Look at your graph — those just appeared, and they're linked to you. That canvas is yours now, and it grows every time we talk.",
} as const
```

- [ ] **Step 2: Typecheck**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/onboarding/script.ts
git commit -m "feat(onboarding): add fixed beat copy constant"
```

---

### Task 2: Client node-seeding helpers

**Files:**
- Create: `apps/web/lib/onboarding/seed.ts`
- Create: `apps/web/scripts/check-onboarding-seed.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`.
- Produces:
  - `toSlug(s: string): string`
  - `stripLeadIn(s: string): string` — normalizes a location answer ("I live in Giessen" → "Giessen")
  - `workNodeTitle(answer: string): string` — heuristic title for the work/study node
  - `seedLocationNode(userId: string, rawAnswer: string): Promise<string>` — upserts a Place node, merges `base_profile.home_location`, returns the cleaned city string
  - `seedWorkNode(userId: string, rawAnswer: string): Promise<void>` — upserts an Org node
  - `completeOnboarding(userId: string): Promise<void>` — sets `profiles.onboarded = true`

- [ ] **Step 1: Write the failing check for the pure functions**

```ts
// apps/web/scripts/check-onboarding-seed.ts
// Runnable self-check for the pure string logic in lib/onboarding/seed.ts.
// DB functions require Supabase and are verified by manual drive, not here.
import assert from "node:assert"
import { toSlug, stripLeadIn, workNodeTitle } from "../lib/onboarding/seed"

assert.equal(toSlug("São Paulo!"), "s-o-paulo")
assert.equal(toSlug("Giessen"), "giessen")

assert.equal(stripLeadIn("I live in Giessen"), "Giessen")
assert.equal(stripLeadIn("i'm from Berlin"), "Berlin")
assert.equal(stripLeadIn("Giessen"), "Giessen")
assert.equal(stripLeadIn("it's Lisbon"), "Lisbon")

assert.equal(workNodeTitle("I'm a nurse at St. Mary's"), "I'm a nurse at St. Mary's".slice(0, 60))
assert.equal(workNodeTitle("studying biology"), "School")
assert.equal(workNodeTitle("I study at uni"), "School")
assert.equal(workNodeTitle("a bit of both"), "Work")
assert.equal(workNodeTitle("work"), "Work")

console.log("check-onboarding-seed: OK")
```

- [ ] **Step 2: Run it to confirm it fails**

Run (from `apps/web`): `pnpm dlx tsx scripts/check-onboarding-seed.ts`
Expected: FAIL — cannot resolve `../lib/onboarding/seed` (module not created yet).

- [ ] **Step 3: Implement the seed module**

```ts
// apps/web/lib/onboarding/seed.ts
import { createClient } from "@/lib/supabase/client"

// Same slug rule as lib/ai/extract.ts so seeded paths match extraction-created ones.
export const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Strip common conversational lead-ins from a location answer so the node title is the
// place itself. ponytail: modest regex; a weird answer still yields a usable-enough node,
// which later extraction/Gardener can refine.
export function stripLeadIn(s: string): string {
  return s
    .trim()
    .replace(
      /^(i (currently )?(live|stay|am|'m) (in|at|from)|i'?m (in|from)|home is|based in|it'?s|currently)\s+/i,
      "",
    )
    .trim()
}

// Title for the work/study node from a freeform answer.
// ponytail: 3-branch heuristic. Ceiling: a vague answer ("a bit of both") yields the
// generic "Work"; when the user later names an employer, extraction adds/updates a node
// and the Gardener can merge. Onboarding just needs a second node to visibly appear.
export function workNodeTitle(answer: string): string {
  const a = answer.trim()
  if (/stud|school|uni|college|degree/i.test(a)) return "School"
  if (/^(work|working|a job|job|both|a bit of both|yes|yeah|kinda)\b/i.test(a) || a.length < 3)
    return "Work"
  return a.slice(0, 60)
}

const NOTE_SELECT = "id, title, topic, path, content_md, intent, source, entity_type"

export async function seedLocationNode(userId: string, rawAnswer: string): Promise<string> {
  const supabase = createClient()
  const city = stripLeadIn(rawAnswer).slice(0, 60) || rawAnswer.trim().slice(0, 60)
  await supabase.from("vault_notes").upsert(
    {
      user_id: userId,
      path: `place/${toSlug(city)}.md`,
      title: city,
      topic: "place",
      entity_type: "place",
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )
  // Merge home_location without clobbering other base_profile keys (mirrors lib/ai/extract.ts).
  const { data: prof } = await supabase
    .from("profiles")
    .select("base_profile")
    .eq("id", userId)
    .single()
  const base = { ...((prof?.base_profile as Record<string, unknown>) ?? {}), home_location: city }
  await supabase.from("profiles").update({ base_profile: base }).eq("id", userId)
  return city
}

export async function seedWorkNode(userId: string, rawAnswer: string): Promise<void> {
  const supabase = createClient()
  const title = workNodeTitle(rawAnswer)
  await supabase.from("vault_notes").upsert(
    {
      user_id: userId,
      path: `org/${toSlug(title)}.md`,
      title,
      topic: "work",
      entity_type: "org",
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("profiles").update({ onboarded: true }).eq("id", userId)
}

// Silence unused-select lint if a reader expects it; NOTE_SELECT documents the shape the
// graph reads back on refresh (see components/graph/GraphCanvas.tsx fetch).
void NOTE_SELECT
```

- [ ] **Step 4: Run the check to verify it passes**

Run (from `apps/web`): `pnpm dlx tsx scripts/check-onboarding-seed.ts`
Expected: prints `check-onboarding-seed: OK`, exit 0.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/onboarding/seed.ts apps/web/scripts/check-onboarding-seed.ts
git commit -m "feat(onboarding): client node-seeding helpers + pure-logic check"
```

---

### Task 3: Example consent card component

**Files:**
- Create: `apps/web/components/chat/ExampleConsentCard.tsx`

**Interfaces:**
- Produces: default export `ExampleConsentCard({ ask }: { ask: string })` — a translucent card showing a sample assistant ask with ghosted, non-interactive `Yes / Not now` affordances.

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/components/chat/ExampleConsentCard.tsx
"use client"

// A STATIC, translucent preview of what the assistant might ask when it spots something —
// NOT the real ad card (that redesign is deferred). The ghosted Yes/Not now make the
// per-moment consent gate visual; they are decorative and do nothing on click.
export default function ExampleConsentCard({ ask }: { ask: string }) {
  return (
    <div
      style={{
        maxWidth: "360px",
        width: "100%",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        backdropFilter: "blur(8px)",
        padding: "18px 18px 14px",
        opacity: 0.85,
        fontFamily: "var(--font-poppins), sans-serif",
      }}
    >
      <p
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.3)",
          margin: "0 0 10px",
        }}
      >
        example
      </p>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: 1.55,
          fontWeight: 300,
          color: "rgba(255,255,255,0.82)",
          margin: "0 0 16px",
        }}
      >
        {ask}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        {["Yes", "Not now"].map((label) => (
          <span
            key={label}
            aria-hidden
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 0",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.85rem",
              userSelect: "none",
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/chat/ExampleConsentCard.tsx
git commit -m "feat(onboarding): translucent example-consent card"
```

---

### Task 4: Graph wiring — live identityPlaces, prompt refresh, onboarded prop

**Files:**
- Modify: `apps/web/app/(app)/graph/page.tsx` (pass `onboarded` to GraphWrapper)
- Modify: `apps/web/components/graph/GraphWrapper.tsx` (lift `identityPlaces` to state; pass `onboarded` + `onLocationSeeded` to ChatPanel)
- Modify: `apps/web/components/graph/GraphCanvas.tsx` (prompt first refresh; add `identityPlaces` to the linking effect deps)

**Interfaces:**
- Consumes: `ChatPanel` will gain props `onboarded: boolean` and `onLocationSeeded?: (city: string) => void` (defined in Task 5; this task wires them from GraphWrapper).
- Produces: GraphWrapper renders ChatPanel with `onboarded` and `onLocationSeeded`.

- [ ] **Step 1: Pass `onboarded` from the graph page**

In `apps/web/app/(app)/graph/page.tsx`, extend the profile select and pass the flag.

Change the profiles query (currently selects `display_name, base_profile`):

```ts
    supabase.from("profiles").select("display_name, base_profile, onboarded").eq("id", user.id).single(),
```

Then pass it into GraphWrapper (add the prop to the existing `<GraphWrapper ... />`):

```tsx
        onboarded={profile?.onboarded ?? true}
```

(Default `true` so an unexpected null never traps an existing user in onboarding.)

- [ ] **Step 2: Lift identityPlaces into GraphWrapper state and wire ChatPanel props**

Replace the body of `apps/web/components/graph/GraphWrapper.tsx` with:

```tsx
"use client"

import { useState, useEffect } from "react"
import GraphCanvas from "./GraphCanvas"
import ChatPanel from "@/components/chat/ChatPanel"
import UserMenu from "@/components/menu/UserMenu"
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GraphSettings } from "@/lib/graph/palettes"
import { isCurrentLocationFresh } from "@/lib/profile/currentLocation"
import type { GraphData } from "@/types/database"

interface Props {
  initialData: GraphData
  userId: string
  userName: string | null
  initialProfile: { display_name: string | null; base_profile: { age?: number; home_location?: string; current_location?: string; current_location_at?: string } }
  initialHistory?: { role: "user" | "assistant"; content: string }[]
  onboarded: boolean
}

export default function GraphWrapper({ initialData, userId, userName, initialProfile, initialHistory, onboarded }: Props) {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [settings, setSettings] = useState<GraphSettings>(DEFAULT_SETTINGS)
  useEffect(() => setSettings(loadSettings()), [])
  const updateSettings = (s: GraphSettings) => { setSettings(s); saveSettings(s) }

  // identityPlaces is state (not a derived const) so onboarding can add the freshly-seeded
  // home city live — a place links to "You" only if its title is in this list.
  const [identityPlaces, setIdentityPlaces] = useState<string[]>(
    [
      initialProfile.base_profile?.home_location,
      isCurrentLocationFresh(initialProfile.base_profile?.current_location_at)
        ? initialProfile.base_profile?.current_location
        : undefined,
    ].filter((s): s is string => !!s),
  )
  const addIdentityPlace = (city: string) =>
    setIdentityPlaces((prev) => (prev.includes(city) ? prev : [...prev, city]))

  return (
    <>
      <GraphCanvas
        initialData={initialData}
        refreshTrigger={refreshTrigger}
        settings={settings}
        identityPlaces={identityPlaces}
      />
      <ChatPanel
        userId={userId}
        userName={userName}
        initialHistory={initialHistory}
        onboarded={onboarded}
        onReply={() => setRefreshTrigger((t) => t + 1)}
        onLocationSeeded={addIdentityPlace}
      />
      <UserMenu
        userId={userId}
        initialProfile={initialProfile}
        onNodeDeleted={() => setRefreshTrigger((t) => t + 1)}
        settings={settings}
        onSettingsChange={updateSettings}
      />
    </>
  )
}
```

- [ ] **Step 3: Prompt refresh + identityPlaces in the linking effect (GraphCanvas)**

In `apps/web/components/graph/GraphCanvas.tsx`:

(a) Add a prompt first fetch. Find the refresh effect's timer line (currently):

```ts
    const timers = [setTimeout(fetchGraph, 3000), setTimeout(fetchGraph, 6500)]
```

Replace with (adds a 250ms fetch so deterministic writes — like onboarding seeds — surface fast; the later fetches still catch async extraction):

```ts
    const timers = [setTimeout(fetchGraph, 250), setTimeout(fetchGraph, 3000), setTimeout(fetchGraph, 6500)]
```

(b) Add `identityPlaces` to the main render effect's dependency array so a live change to it re-runs the You-linking even if `graphData` is unchanged. Find the effect that ends with:

```ts
  }, [graphData, palette])
```

Change it to:

```ts
  }, [graphData, palette, identityPlaces])
```

- [ ] **Step 4: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0. (ChatPanel already accepts `onReply`; the new `onboarded`/`onLocationSeeded` props are added in Task 5 — if typecheck flags them as unknown props here, proceed to Task 5 in the same branch before building. If executing strictly task-by-task, temporarily widen ChatPanel's props in Task 5 first, then wire here. Recommended: run Task 4 Step 4 typecheck together with Task 5.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(app)/graph/page.tsx apps/web/components/graph/GraphWrapper.tsx apps/web/components/graph/GraphCanvas.tsx
git commit -m "feat(onboarding): live identityPlaces state, prompt graph refresh, onboarded prop"
```

---

### Task 5: ChatPanel onboarding mode

**Files:**
- Modify: `apps/web/components/chat/ChatPanel.tsx`

**Interfaces:**
- Consumes: `onboardingCopy` (Task 1); `seedLocationNode`, `seedWorkNode`, `completeOnboarding` (Task 2); `ExampleConsentCard` (Task 3); `onboarded` + `onLocationSeeded` props (Task 4).
- Produces: onboarding runs entirely client-side for beats 1–6, then transitions in place to the normal interview (beat 7 via `/api/chat`).

- [ ] **Step 1: Add imports**

At the top of `apps/web/components/chat/ChatPanel.tsx`, below the existing `AdCardView` import:

```tsx
import ExampleConsentCard from "./ExampleConsentCard"
import { onboardingCopy } from "@/lib/onboarding/script"
import { seedLocationNode, seedWorkNode, completeOnboarding } from "@/lib/onboarding/seed"
```

- [ ] **Step 2: Extend the props and add onboarding state**

Change the component signature from:

```tsx
export default function ChatPanel({ userId, userName: _userName, initialHistory = [], onReply }: { userId: string; userName: string | null; initialHistory?: ChatMessage[]; onReply?: () => void }) {
```

to:

```tsx
type ObStep = "welcome" | "howto" | "consent" | "location" | "work" | "confirm" | "interview"

export default function ChatPanel({ userId, userName, initialHistory = [], onReply, onboarded = true, onLocationSeeded }: { userId: string; userName: string | null; initialHistory?: ChatMessage[]; onReply?: () => void; onboarded?: boolean; onLocationSeeded?: (city: string) => void }) {
```

Then, right after the existing `seedHistory` line (`const seedHistory = seeded ? initialHistory.slice(0, -1) : initialHistory`), add:

```tsx
  // Onboarding runs only for a brand-new user with no restored conversation. Beats 1–6 are
  // client-side (no /api/chat); beat 7 is the live interviewer after the flag flips.
  const startInOnboarding = !onboarded && !seeded
```

And add these state hooks alongside the other `useState` calls (e.g. after `const [streamDone, setStreamDone] = useState(true)`):

```tsx
  const [obStep, setObStep] = useState<ObStep>(startInOnboarding ? "welcome" : "interview")
  const histAfterWorkRef = useRef<ChatMessage[]>([])
  const handoffRef = useRef(false)
  const onboarding = obStep !== "interview"
```

- [ ] **Step 3: Skip the opener fetch during onboarding and show beat 1**

Replace the mount opener effect (currently the `useEffect` that starts `if (seeded) return`) with:

```tsx
  useEffect(() => {
    if (seeded) return // restored an active conversation — show where we left off, no opener fetch
    if (startInOnboarding) {
      // Beat 1 — no network. currentAi is the first scripted line; typewriter → canInput.
      setCurrentAi(onboardingCopy.welcome(userName ?? "there"))
      setAiVisible(true)
      setLoading(false)
      return
    }
    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [], userId }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ reply, card: openerCard }) => { setCurrentAi(reply); setCard(openerCard ?? null); setAiVisible(true) })
      .catch(() => { setCurrentAi("Hey — what have you been up to today?"); setAiVisible(true) })
      .finally(() => setLoading(false))
  }, [userId, seeded, startInOnboarding, userName])
```

- [ ] **Step 4: Add the onboarding send handler**

Add this `useCallback` immediately before the existing `send` callback:

```tsx
  // Advance the scripted onboarding one beat per user reply. Beats 1–3 ignore the reply
  // text (any ack advances); beats 4–5 seed a graph node from it; then confirm + handoff.
  const sendOnboarding = useCallback(async (text: string) => {
    setCanInput(false)
    setInput("")
    setAiVisible(false)

    // Keep the transcript so the interviewer has context at handoff.
    const withTurn = (): ChatMessage[] => [
      ...history,
      { role: "assistant", content: currentAi },
      { role: "user", content: text },
    ]

    if (obStep === "welcome") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.howto); setObStep("howto"); setAiVisible(true); return
    }
    if (obStep === "howto") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.consentIntro); setObStep("consent"); setAiVisible(true); return
    }
    if (obStep === "consent") {
      setHistory(withTurn()); setCurrentAi(onboardingCopy.askLocation); setObStep("location"); setAiVisible(true); return
    }
    if (obStep === "location") {
      const next = withTurn()
      setHistory(next)
      setLoading(true)
      try {
        const city = await seedLocationNode(userId, text)
        onLocationSeeded?.(city)
      } catch { /* seeding failed — still advance; the flow must not stall */ }
      onReply?.() // refresh the graph so the Place node pops
      setLoading(false)
      setCurrentAi(onboardingCopy.askWork); setObStep("work"); setAiVisible(true); return
    }
    if (obStep === "work") {
      const next = withTurn()
      setHistory(next)
      histAfterWorkRef.current = next // handoff replays this to the interviewer for beat 7
      setLoading(true)
      try {
        await seedWorkNode(userId, text)
      } catch { /* see above */ }
      onReply?.() // refresh so the Org node pops alongside the Place node
      setLoading(false)
      setCurrentAi(onboardingCopy.confirm); setObStep("confirm"); setAiVisible(true); return
    }
  }, [obStep, history, currentAi, userId, onReply, onLocationSeeded])
```

- [ ] **Step 5: Add the handoff effect (confirm → live interviewer)**

Add this effect after the `sendOnboarding` callback (and after the existing `useEffect(() => { if (done) setCanInput(true) }, [done])`):

```tsx
  // After the confirm beat is read, flip the flag and let the real interviewer produce
  // beat 7 from the seeded facts. Runs once. completeOnboarding MUST precede the fetch so
  // the route takes the interview path, never the (now-deleted) onboarding path.
  useEffect(() => {
    if (obStep !== "confirm" || !done || handoffRef.current) return
    handoffRef.current = true
    const t = setTimeout(async () => {
      setAiVisible(false)
      setLoading(true)
      try {
        await completeOnboarding(userId)
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: histAfterWorkRef.current, userId }),
        })
        const { reply } = res.ok ? await res.json() : { reply: "So — what's your day been like?" }
        setHistory(histAfterWorkRef.current)
        setCurrentAi(reply ?? "So — what's your day been like?")
      } catch {
        setHistory(histAfterWorkRef.current)
        setCurrentAi("So — what's your day been like?")
      } finally {
        setObStep("interview")
        setLoading(false)
        setAiVisible(true)
      }
    }, 900) // let the graph animation + confirm line land before the interviewer speaks
    return () => clearTimeout(t)
  }, [obStep, done, userId])
```

- [ ] **Step 6: Route Enter/submit to the right handler**

The existing `send` callback handles the interview. Wrap dispatch so onboarding beats use `sendOnboarding`. Change `handleKeyDown` and the submit button `onClick` to call a single dispatcher. Add this dispatcher just before `handleKeyDown`:

```tsx
  const submit = useCallback(() => {
    const text = input.trim()
    if (!text || loading || !canInput) return
    if (onboarding) { void sendOnboarding(text); return }
    void send()
  }, [input, loading, canInput, onboarding, sendOnboarding, send])
```

Change `handleKeyDown` to call `submit()`:

```tsx
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    }
  }
```

And change the send button's `onClick={send}` (in the JSX) to `onClick={submit}`.

- [ ] **Step 7: Render the example card during the consent beat**

In the mid-screen card area, the current block is:

```tsx
      <div className="flex-1 flex items-center justify-center">
        {card && (
          <div className="pointer-events-auto">
            <AdCardView card={card} />
          </div>
        )}
      </div>
```

Replace with (adds the example card for the consent beat):

```tsx
      <div className="flex-1 flex items-center justify-center">
        {obStep === "consent" ? (
          <div className="pointer-events-none">
            <ExampleConsentCard ask={onboardingCopy.exampleAsk} />
          </div>
        ) : (
          card && (
            <div className="pointer-events-auto">
              <AdCardView card={card} />
            </div>
          )
        )}
      </div>
```

- [ ] **Step 8: Typecheck**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0. (This clears the Task 4 Step 4 note — ChatPanel now declares `onboarded`/`onLocationSeeded`.)

- [ ] **Step 9: Build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10: Manual drive**

1. Invoke `/hype-reset` (resets `onboarded=false`, wipes vault).
2. Run `pnpm dev`, open `/graph`, log in.
3. Verify: the "You" node breathes alone; beat 1 appears. Type any reply → beat 2 → beat 3 with the translucent example card + ghosted Yes/Not now.
4. Reply to advance → beat 4. Type a city (e.g. "I live in Giessen") → within ~1s a Place node ("Giessen") pops and links to You; beat 5 appears.
5. Answer beat 5 (e.g. "I'm a nurse") → an Org node pops and links to You; the confirm line shows; ~1s later the interviewer's beat-7 line appears referencing your answers.
6. Confirm `onboarded` is now true (a reload shows the normal interview, not onboarding).

- [ ] **Step 11: Commit**

```bash
git add apps/web/components/chat/ChatPanel.tsx
git commit -m "feat(onboarding): deterministic 7-beat flow in ChatPanel with live node seeding"
```

---

### Task 6: Delete the LLM onboarding path from the chat route

**Files:**
- Modify: `apps/web/app/api/chat/route.ts`

**Interfaces:**
- Produces: a chat route with no concept of onboarding (net deletion). `geminiChat` no longer takes a `jsonSchema` argument.

- [ ] **Step 1: Remove onboarding constants**

Delete the `ONBOARDING_SCHEMA` object (the `const ONBOARDING_SCHEMA = { ... }` block) and the entire `ONBOARDING_PROMPT` template string constant.

- [ ] **Step 2: Simplify `geminiChat`**

The `jsonSchema` param is now unused (nothing on the chat path passes a schema). Change the signature and body:

From:
```ts
async function geminiChat(system: string, history: ChatMsg[], jsonSchema?: object): Promise<string> {
```
to:
```ts
async function geminiChat(system: string, history: ChatMsg[]): Promise<string> {
```

Replace the `generationConfig` block and the schema line with a plain config (drop the `jsonSchema ? 0 : 0.8` ternary and the `if (jsonSchema) {...}` line):

```ts
  const generationConfig: Record<string, unknown> = { temperature: 0.8, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 512 }
```

- [ ] **Step 3: Remove onboarding branches in POST**

- Delete `const isOnboarding = profile?.onboarded === false` and replace every `isOnboarding` usage:
  - `if (hasAdMarker && !isOnboarding && ...)` → `if (hasAdMarker && ...)`
  - `if (inAdProposed && !isOnboarding && ...)` → `if (inAdProposed && ...)`
  - `const isWelcomeBack = isOpeningMessage && !isOnboarding && ...` → drop the `!isOnboarding &&`
  - `const systemPrompt = isOnboarding ? ONBOARDING_PROMPT.replace(...) : <interview prompt>` → keep only the interview branch (the `else` value).
  - `if (stream === true && !isOnboarding && !scoutFind)` → `if (stream === true && !scoutFind)`
  - `raw = await geminiChat(systemPrompt, history, isOnboarding ? ONBOARDING_SCHEMA : undefined)` → `raw = await geminiChat(systemPrompt, history)`
- Delete `let onboardingComplete = false` and the entire `if (isOnboarding) { ... }` reply-parsing block (the strict-parse + Cerebras-retry block).
- In `finishTurn`, delete the `if (onboardingComplete) { await supabase.from("profiles").update({ onboarded: true })... }` block (onboarding completion is now client-side).
- The `if (!isOnboarding) { <extraction> }` guard around extraction → remove the guard, keep the extraction body running unconditionally (there is no onboarding turn reaching this route anymore).

- [ ] **Step 4: Grep to confirm nothing remains**

Run (from `apps/web`): `grep -n "isOnboarding\|ONBOARDING_\|onboardingComplete" app/api/chat/route.ts`
Expected: no matches.

- [ ] **Step 5: Typecheck + build**

Run: `pnpm exec tsc --noEmit` then `pnpm build`
Expected: both succeed. (If `userName`/other now-unused bindings warn, remove them.)

- [ ] **Step 6: Regression drive — normal chat still works**

With an already-onboarded account (or after completing onboarding in Task 5), open `/graph` and send a normal message. Verify a streamed reply arrives and the graph refreshes. This confirms deleting the onboarding branch didn't disturb the interview path.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/chat/route.ts
git commit -m "refactor(chat): delete LLM onboarding path — permanent fix for Gemini degeneration"
```

---

## Self-Review

**Spec coverage:**
- 7-beat flow → Tasks 1 (copy), 5 (state machine). ✓
- Example consent card (sample ask, ghosted Yes/Not now) → Task 3, rendered in Task 5 Step 7. ✓
- Deterministic node seeding (Place + Org, home_location merge, title heuristic) → Task 2. ✓
- Live You-linking (identityPlaces as state, prompt refresh) → Task 4. ✓
- Handoff to real interviewer (flag flip before fetch, replay Q&A) → Task 5 Step 5. ✓
- Deletion of LLM onboarding path + geminiChat simplification → Task 6. ✓
- Known limitations (no mid-onboarding reload persistence; generic work node) → encoded in Task 2 heuristic comment + accepted; no task needed.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output.

**Type consistency:** `onboarded`/`onLocationSeeded` props declared in Task 5 Step 2 match their use in Task 4 GraphWrapper. `seedLocationNode` returns `Promise<string>` (city) consumed by `onLocationSeeded` in Task 5 Step 4. `histAfterWorkRef` (Task 5 Step 2) written in Step 4, read in Step 5. `ObStep` union consistent across steps. `onboardingCopy` fields (Task 1) all referenced correctly in Task 5.

**Cross-task ordering note:** Task 4 typecheck depends on Task 5's prop declarations — flagged in Task 4 Step 4; run Tasks 4+5 typecheck together, commit separately.

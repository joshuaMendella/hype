# Onboarding Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Improve the deterministic onboarding flow from four live-test findings: (1) better node creation via a server-side structured LLM call with regex fallback, (2) every beat invites a typed reply (per-beat placeholders + confirmation questions), (3) the example card reveals *after* the assistant line finishes printing, (4) rewritten copy that delivers real value. Beat order unchanged (consent stays at beat 3).

**Architecture:** Node seeding moves from client-side regex (`lib/onboarding/seed.ts`) to a new authenticated server route `POST /api/onboarding/seed` that does a tiny temperature-0 structured Gemini call (`{title, entity_type, confidence}`) with the old regex heuristics as fallback. The route authenticates from the cookie session (never trusts a body `userId`) and writes RLS-scoped. ChatPanel calls it via fetch, keeps the instant graph bloom, adds a one-shot in-voice retry for vague work answers, gates the consent card on typewriter completion, and drives per-beat input placeholders. Copy lives in `lib/onboarding/script.ts` (swappable in one file — owner will refine wording later).

**Tech Stack:** Next.js 16 route handler, TypeScript, Supabase server client (RLS), Gemini 2.5 Flash structured output (same pattern as `lib/ai/synthesize.ts`). No new dependencies.

## Global Constraints

- **No new dependencies.**
- **Auth:** the seed route authenticates via `createClient()` from `@/lib/supabase/server` + `supabase.auth.getUser()`. The `userId` is NEVER read from the request body. Writes go through that RLS-scoped client.
- **Gemini call shape** mirrors `lib/ai/synthesize.ts` `extractGemini`: `responseMimeType: "application/json"`, `responseSchema` (uppercase OpenAPI types), `thinkingConfig: { thinkingBudget: 0 }`, `temperature: 0`. This is structured/schema-constrained — a different risk profile from the deleted conversational-script degeneration bug.
- **Slug rule** (unchanged): `s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")`.
- **vault_notes upsert** on `onConflict: "user_id,path"`; node shape matches the old seed: `{ user_id, path, title, topic, entity_type, content_md:"", intent:false, source:"system", confidence:1, archived_at:null }`.
- **You-linking is client-side** in GraphCanvas: `org` and `interest` auto-link to You; a `place` links only if its title is in the live `identityPlaces` state (so a seeded city must still be passed to `onLocationSeeded`).
- **Copy is fixed** for this build (Fable locked draft, 2026-07-12) — use exact strings. Keep "hyper-tailored" verbatim.
- **Verification:** pure logic → `scripts/check-onboarding-seed.ts` (`pnpm dlx tsx`). Route/UI → typecheck (`pnpm exec tsc --noEmit`) + build (`pnpm build`) + owner manual drive. Run all commands from `apps/web`.

---

### Task 1: Extract pure title helpers + slim down seed.ts

**Files:**
- Create: `apps/web/lib/onboarding/titles.ts`
- Modify: `apps/web/lib/onboarding/seed.ts` (drop the two client seed fns + the pure helpers; keep only `completeOnboarding`)
- Modify: `apps/web/scripts/check-onboarding-seed.ts` (import from titles.ts; add `isVagueWork` checks)

**Interfaces:**
- Produces: `toSlug`, `stripLeadIn`, `workNodeTitle`, `isVagueWork` in `titles.ts` (pure, no imports — usable server- and client-side). `seed.ts` still exports `completeOnboarding(userId): Promise<void>`.

- [ ] **Step 1: Create `titles.ts`**

```ts
// apps/web/lib/onboarding/titles.ts
// Pure title/type heuristics for onboarding node seeding. NO imports — safe from both
// browser and server. The /api/onboarding/seed route imports these as the fallback when
// the structured LLM classify call fails. (Extracted from the old seed.ts.)

export const toSlug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Strip conversational lead-ins from a location answer so the node title is the place itself.
export function stripLeadIn(s: string): string {
  return s
    .trim()
    .replace(
      /^(i (currently )?(live|stay|am|'m) (in|at|from)|i'?m (in|from)|home is|based in|it'?s|currently)\s+/i,
      "",
    )
    .trim()
}

// Fallback title for the work/study node (LLM classify is the primary path).
export function workNodeTitle(answer: string): string {
  const a = answer.trim()
  if (/stud|school|uni|college|degree/i.test(a)) return "School"
  if (/^(work|working|a job|job|both|a bit of both|yes|yeah|kinda)\b/i.test(a) || a.length < 3)
    return "Work"
  return a.slice(0, 60)
}

// A category-shaped / non-committal work answer that would yield a weak node — triggers the
// one-shot in-voice retry ("what's the biggest slice?") before anything is seeded.
export function isVagueWork(answer: string): boolean {
  const a = answer.trim().toLowerCase()
  if (a.length < 3) return true
  return /^(work|working|a job|job|both|a bit of both|a bit of everything|everything|stuff|things|yes|yeah|kinda|idk|not sure|dunno|this and that)\b\.?$/.test(a)
}
```

- [ ] **Step 2: Replace `seed.ts` with just `completeOnboarding`**

Full new contents:

```ts
// apps/web/lib/onboarding/seed.ts
import { createClient } from "@/lib/supabase/client"

// Flip the onboarding flag once the scripted beats are done (client-side RLS write).
// Node seeding moved to POST /api/onboarding/seed (it needs the server-only Gemini key).
export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = createClient()
  await supabase.from("profiles").update({ onboarded: true }).eq("id", userId)
}
```

- [ ] **Step 3: Update the check script**

In `apps/web/scripts/check-onboarding-seed.ts`, change the import line from `../lib/onboarding/seed` to `../lib/onboarding/titles` and add `isVagueWork` to the import and to the assertions. Full new contents:

```ts
// apps/web/scripts/check-onboarding-seed.ts
// Runnable self-check for the pure string logic in lib/onboarding/titles.ts.
import assert from "node:assert"
import { toSlug, stripLeadIn, workNodeTitle, isVagueWork } from "../lib/onboarding/titles"

assert.equal(toSlug("São Paulo!"), "s-o-paulo")
assert.equal(toSlug("Giessen"), "giessen")

assert.equal(stripLeadIn("I live in Giessen"), "Giessen")
assert.equal(stripLeadIn("i'm from Berlin"), "Berlin")
assert.equal(stripLeadIn("Giessen"), "Giessen")
assert.equal(stripLeadIn("it's Lisbon"), "Lisbon")

assert.equal(workNodeTitle("I'm a nurse at St. Mary's"), "I'm a nurse at St. Mary's".slice(0, 60))
assert.equal(workNodeTitle("studying biology"), "School")
assert.equal(workNodeTitle("a bit of both"), "Work")
assert.equal(workNodeTitle("work"), "Work")

assert.equal(isVagueWork("a bit of both"), true)
assert.equal(isVagueWork("work"), true)
assert.equal(isVagueWork("stuff"), true)
assert.equal(isVagueWork("mech eng at THM"), false)
assert.equal(isVagueWork("biology"), false)
assert.equal(isVagueWork("I'm a nurse"), false)

console.log("check-onboarding-seed: OK")
```

- [ ] **Step 4: Run the check**

Run (from `apps/web`): `pnpm dlx tsx scripts/check-onboarding-seed.ts`
Expected: prints `check-onboarding-seed: OK`, exit 0.

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0. (ChatPanel still imports `seedLocationNode`/`seedWorkNode` from seed.ts at this point and WILL error — that import is fixed in Task 4. If running strictly task-by-task, this typecheck is expected to fail on ChatPanel only; the titles/seed/route files themselves must be clean. Recommended: run Task 1's typecheck together with Task 4, or accept the known ChatPanel-only error here.)

- [ ] **Step 6: Commit**

```bash
git -C "C:/Users/mende/desktop/hype" add apps/web/lib/onboarding/titles.ts apps/web/lib/onboarding/seed.ts apps/web/scripts/check-onboarding-seed.ts
git -C "C:/Users/mende/desktop/hype" commit -m "refactor(onboarding): extract pure title helpers to titles.ts, slim seed.ts"
```

---

### Task 2: Structured classify + server seed route

**Files:**
- Create: `apps/web/lib/onboarding/classify.ts`
- Create: `apps/web/app/api/onboarding/seed/route.ts`

**Interfaces:**
- Consumes: `ENTITY_TYPES` from `@/lib/ai/entityTypes`; `stripLeadIn`, `workNodeTitle` from `./titles`.
- Produces: `classifySeed(kind: "location" | "work", answer: string): Promise<{title, entity_type, confidence}>`. Route `POST /api/onboarding/seed` accepting `{ kind, answer, force? }`, returning `{ title, entity_type, lowConfidence }`.

- [ ] **Step 1: Create `classify.ts`**

```ts
// apps/web/lib/onboarding/classify.ts
// Server-only. One tiny structured Gemini call turning a freeform onboarding answer into a
// clean graph node {title, entity_type, confidence}. Falls back to the regex heuristics in
// titles.ts if the call fails or the key is absent. Schema-constrained + temperature 0 —
// same risk profile as lib/ai/synthesize.ts, NOT the deleted conversational onboarding path.
import { ENTITY_TYPES } from "@/lib/ai/entityTypes"
import { stripLeadIn, workNodeTitle } from "./titles"

const GEMINI_MODEL = "gemini-2.5-flash"
const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export type SeedKind = "location" | "work"
export interface SeedClassification { title: string; entity_type: string; confidence: number }

const LOCATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "The bare city/town name only, e.g. 'Giessen' — no lead-in words, no sentence." },
    confidence: { type: "NUMBER", description: "0..1 — how clearly the answer names a real place." },
  },
  required: ["title", "confidence"],
}

const WORK_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "The specific NAMED thing that fills their week — an employer, school, degree, or personal project (e.g. 'THM', 'biology', 'freelance design'). The bare noun, not a sentence." },
    entity_type: { type: "STRING", enum: ["org", "interest"], description: "org = a named employer/school/team. interest = a field/discipline/hobby with no organization behind it." },
    confidence: { type: "NUMBER", description: "0..1 — low if the answer is vague/category-shaped ('a bit of both', 'work', 'stuff') with nothing concrete named." },
  },
  required: ["title", "entity_type", "confidence"],
}

const LOCATION_SYS = "You clean a user's answer to 'what city is home right now?' into a single place name for a knowledge-graph node. Return the bare city/town name as the user would write it, nothing else."
const WORK_SYS = "You turn a user's answer to 'what does your week mostly go to?' into one knowledge-graph node. Pull the specific named thing (employer, school, degree, project) as the title and classify it as an org (a named organization) or an interest (a field/discipline with no organization). If the answer is vague or category-shaped with nothing concrete, set confidence low."

async function callGemini(sys: string, schema: object, answer: string): Promise<SeedClassification | null> {
  if (!GEMINI_KEY) return null
  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: "user", parts: [{ text: answer }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0,
          maxOutputTokens: 200,
        },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text)
    const title = String(parsed.title ?? "").trim()
    if (!title) return null
    return {
      title: title.slice(0, 60),
      entity_type: parsed.entity_type ?? "place",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    }
  } catch {
    return null
  }
}

export async function classifySeed(kind: SeedKind, answer: string): Promise<SeedClassification> {
  if (kind === "location") {
    const c = await callGemini(LOCATION_SYS, LOCATION_SCHEMA, answer)
    if (c) return { ...c, entity_type: "place" } // a home city is always a place
    const title = stripLeadIn(answer).slice(0, 60) || answer.trim().slice(0, 60)
    return { title, entity_type: "place", confidence: title ? 0.6 : 0 }
  }
  // work
  const c = await callGemini(WORK_SYS, WORK_SCHEMA, answer)
  if (c) {
    const et = (ENTITY_TYPES as readonly string[]).includes(c.entity_type) ? c.entity_type : "org"
    return { ...c, entity_type: et }
  }
  return { title: workNodeTitle(answer), entity_type: "org", confidence: 0.4 }
}
```

- [ ] **Step 2: Create the route**

```ts
// apps/web/app/api/onboarding/seed/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { classifySeed, type SeedKind } from "@/lib/onboarding/classify"
import { toSlug, isVagueWork } from "@/lib/onboarding/titles"

// Seeds one onboarding graph node (home city or occupation) from a freeform answer.
// Auth comes from the cookie session — userId is NEVER trusted from the body; writes are
// RLS-scoped to that user. Returns the clean node title + a lowConfidence flag the client
// uses to fire a single in-voice retry before committing a weak work node.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const kind: SeedKind = body.kind === "work" ? "work" : "location"
  const answer = typeof body.answer === "string" ? body.answer.trim() : ""
  const force = body.force === true
  if (!answer) return NextResponse.json({ error: "empty_answer" }, { status: 400 })

  const c = await classifySeed(kind, answer)
  const lowConfidence = kind === "work" && (c.confidence < 0.5 || isVagueWork(answer))

  // Weak work answer, first pass → don't write yet; the client asks one clarifying question
  // and re-posts with force. Location never retries.
  if (lowConfidence && !force) {
    return NextResponse.json({ title: c.title, entity_type: c.entity_type, lowConfidence: true })
  }

  const dir = c.entity_type // "place" | "org" | "interest" — folder mirrors entity type
  const topic = kind === "location" ? "place" : "work"
  await supabase.from("vault_notes").upsert(
    {
      user_id: user.id,
      path: `${dir}/${toSlug(c.title)}.md`,
      title: c.title,
      topic,
      entity_type: c.entity_type,
      content_md: "",
      intent: false,
      source: "system",
      confidence: 1,
      archived_at: null,
    },
    { onConflict: "user_id,path" },
  )

  if (kind === "location") {
    const { data: prof } = await supabase.from("profiles").select("base_profile").eq("id", user.id).single()
    const base = { ...((prof?.base_profile as Record<string, unknown>) ?? {}), home_location: c.title }
    await supabase.from("profiles").update({ base_profile: base }).eq("id", user.id)
  }

  return NextResponse.json({ title: c.title, entity_type: c.entity_type, lowConfidence: false })
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0 for the two new files (the ChatPanel import error from Task 1 may persist until Task 4 — that's fine).

- [ ] **Step 4: Commit**

```bash
git -C "C:/Users/mende/desktop/hype" add apps/web/lib/onboarding/classify.ts apps/web/app/api/onboarding/seed/route.ts
git -C "C:/Users/mende/desktop/hype" commit -m "feat(onboarding): server seed route with structured LLM classify + regex fallback"
```

---

### Task 3: New copy + per-beat placeholders

**Files:**
- Modify: `apps/web/lib/onboarding/script.ts` (full replace)

**Interfaces:**
- Produces: `onboardingCopy` with `welcome(name)`, `askWork(city)` functions and string fields `howto, consentIntro, consentTrailing, exampleAsk, askLocation, workRetry, confirm`; plus `onboardingPlaceholder: Record<string,string>`.

- [ ] **Step 1: Replace `script.ts`**

```ts
// apps/web/lib/onboarding/script.ts
// Fixed onboarding copy (Fable locked draft, 2026-07-12). Beats 1–6 are deterministic and
// app-rendered — never routed through an LLM. Beat 7 is the live interviewer. Owner will
// refine wording later; keep this a single swappable source of truth.
export const onboardingCopy = {
  welcome: (name: string) => `Hey ${name}. Go on — say hi back. That's genuinely the whole tutorial.`,
  howto:
    "See that lone dot behind this chat? That's you, day one. Everything you tell me becomes part of that map — quietly, while we just talk. But first, the honest bit about how this works.",
  consentIntro:
    "Here's the deal up front: Hype's free, and it stays free because once I really know you, I'll occasionally spot something hyper-tailored — a price drop, a show near you, a thing you actually wanted. I never just show it. I ask first, like this:",
  consentTrailing:
    "You say yes or no, every single time. No toggle buried in settings — just me, asking. Fair deal?",
  exampleAsk:
    "Hey — those running shoes you'd been eyeing just dropped in price. Want me to pull it up?",
  askLocation: "Good. Now the easy stuff — what city is home right now?",
  askWork: (city: string) =>
    `${city} — there it is, your first pin. Next: what does your week mostly go to? A job, a degree, something of your own — name it the way you'd tell a friend.`,
  workRetry: "Ha — fair. What's the biggest slice, though?",
  confirm:
    "Look at the graph — those two just grew out of what you said, and they're linked to you. That's the whole loop: you talk, it grows. And it's yours — readable, exportable, deletable, down to every note. Spot them?",
} as const

// Input placeholder per beat — mirrors the expected reply so the user knows to type
// (solves "do I type here?" without an instruction). Keyed by ObStep.
export const onboardingPlaceholder: Record<string, string> = {
  welcome: "say hi",
  howto: "go on",
  consent: "fair enough?",
  location: "your city",
  work: "what you do",
  confirm: "…",
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exit 0 for this file (ChatPanel errors until Task 4).

- [ ] **Step 3: Commit**

```bash
git -C "C:/Users/mende/desktop/hype" add apps/web/lib/onboarding/script.ts
git -C "C:/Users/mende/desktop/hype" commit -m "feat(onboarding): rewritten beat copy + per-beat input placeholders"
```

---

### Task 4: Wire ChatPanel — fetch seeding, placeholders, card timing, retry, echo

**Files:**
- Modify: `apps/web/components/chat/ChatPanel.tsx`

**Interfaces:**
- Consumes: `onboardingCopy`, `onboardingPlaceholder` (Task 3); `completeOnboarding` (Task 1); `POST /api/onboarding/seed` (Task 2); existing `onboarded` + `onLocationSeeded` props.

- [ ] **Step 1: Fix imports**

Replace the three onboarding import lines (currently):

```tsx
import ExampleConsentCard from "./ExampleConsentCard"
import { onboardingCopy } from "@/lib/onboarding/script"
import { seedLocationNode, seedWorkNode, completeOnboarding } from "@/lib/onboarding/seed"
```

with:

```tsx
import ExampleConsentCard from "./ExampleConsentCard"
import { onboardingCopy, onboardingPlaceholder } from "@/lib/onboarding/script"
import { completeOnboarding } from "@/lib/onboarding/seed"
```

- [ ] **Step 2: Add card-timing + retry state**

After the existing `const handoffRef = useRef(false)` line, add:

```tsx
  const [showConsentCard, setShowConsentCard] = useState(false)
  const [showConsentTrailing, setShowConsentTrailing] = useState(false)
  const workRetriedRef = useRef(false)
```

- [ ] **Step 3: Gate input during the consent beat**

Replace the existing effect:

```tsx
  useEffect(() => {
    if (done) setCanInput(true)
  }, [done])
```

with (input waits for the trailing consent line on the consent beat; every other beat unlocks on typewriter done):

```tsx
  useEffect(() => {
    if (done && obStep !== "consent") setCanInput(true)
  }, [done, obStep])

  // Consent beat: reveal the example card after the line finishes printing (+400ms), then
  // the trailing "you say yes or no" line (+1.2s), which is what unlocks input. Card is the
  // payoff of "…like this:" — it must arrive as a reveal, never alongside the text.
  useEffect(() => {
    if (obStep !== "consent") { setShowConsentCard(false); setShowConsentTrailing(false); return }
    if (!shownDone) return
    const t1 = setTimeout(() => setShowConsentCard(true), 400)
    const t2 = setTimeout(() => setShowConsentTrailing(true), 1600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [obStep, shownDone])

  useEffect(() => {
    if (showConsentTrailing) setCanInput(true)
  }, [showConsentTrailing])
```

- [ ] **Step 4: Replace the location + work branches in `sendOnboarding`**

In the `sendOnboarding` callback, replace the two branches `if (obStep === "location") { ... }` and `if (obStep === "work") { ... }` with:

```tsx
    if (obStep === "location") {
      const next = withTurn()
      setHistory(next)
      setLoading(true)
      let cityTitle = text.trim()
      try {
        const r = await fetch("/api/onboarding/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "location", answer: text }),
        })
        const d = await r.json().catch(() => ({}))
        if (d?.title) cityTitle = d.title
      } catch { /* seeding failed — still advance with the raw answer */ }
      onLocationSeeded?.(cityTitle) // place links to You only if its title is in identityPlaces
      onReply?.() // refresh so the Place node pops
      setLoading(false)
      setCurrentAi(onboardingCopy.askWork(cityTitle)); setObStep("work"); setAiVisible(true); return
    }
    if (obStep === "work") {
      const next = withTurn()
      setHistory(next)
      setLoading(true)
      const force = workRetriedRef.current
      let low = false
      try {
        const r = await fetch("/api/onboarding/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "work", answer: text, force }),
        })
        const d = await r.json().catch(() => ({}))
        low = d?.lowConfidence === true
      } catch { /* seeding failed — treat as committed, don't stall */ }
      setLoading(false)
      // Vague first answer → one in-voice clarifier, stay on the work beat (nothing seeded yet).
      if (low && !force) {
        workRetriedRef.current = true
        setCurrentAi(onboardingCopy.workRetry); setAiVisible(true); return
      }
      histAfterWorkRef.current = next // handoff replays this to the interviewer for beat 7
      onReply?.() // node written → refresh so the Org/Interest node pops
      setCurrentAi(onboardingCopy.confirm); setObStep("confirm"); setAiVisible(true); return
    }
```

- [ ] **Step 5: Per-beat placeholder**

Just before the `return (` of the component (e.g. after the `borderColor` const), add:

```tsx
  const inputPlaceholder = onboarding
    ? (onboardingPlaceholder[obStep] ?? "")
    : "your answer… [notes in brackets]"
```

Then in the `<input>`, change:

```tsx
                placeholder={canInput ? "your answer… [notes in brackets]" : ""}
```

to:

```tsx
                placeholder={canInput ? inputPlaceholder : ""}
```

- [ ] **Step 6: Reveal the card after the text prints + trailing line**

Replace the mid-screen block (currently gated on `obStep === "consent"` rendering the card immediately):

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

with (card only after `showConsentCard`; trailing line fades in after `showConsentTrailing`):

```tsx
      <div className="flex-1 flex items-center justify-center">
        {obStep === "consent" ? (
          showConsentCard && (
            <div className="pointer-events-none flex flex-col items-center gap-4">
              <ExampleConsentCard ask={onboardingCopy.exampleAsk} />
              <p
                style={{
                  fontFamily: "var(--font-poppins), sans-serif",
                  fontSize: "clamp(0.95rem, 1.7vw, 1.1rem)",
                  fontWeight: 300,
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.7)",
                  textAlign: "center",
                  maxWidth: "360px",
                  opacity: showConsentTrailing ? 1 : 0,
                  transition: "opacity 0.5s ease",
                }}
              >
                {onboardingCopy.consentTrailing}
              </p>
            </div>
          )
        ) : (
          card && (
            <div className="pointer-events-auto">
              <AdCardView card={card} />
            </div>
          )
        )}
      </div>
```

- [ ] **Step 7: Typecheck**

Run (from `apps/web`): `pnpm exec tsc --noEmit`
Expected: exit 0 (this also clears any Task 1/2/3 ChatPanel-import errors).

- [ ] **Step 8: Build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 9: Manual drive — SKIP (owner does this)**

The owner will drive `/hype-reset` → `pnpm dev` → `/graph`. Do not attempt (needs a running server + login). Report that Step 9 was skipped.

- [ ] **Step 10: Commit**

```bash
git -C "C:/Users/mende/desktop/hype" add apps/web/components/chat/ChatPanel.tsx
git -C "C:/Users/mende/desktop/hype" commit -m "feat(onboarding): route-based seeding, per-beat placeholders, card reveal, work retry"
```

---

## Self-Review

**Spec coverage:**
- #1 better node creation (server LLM classify + fallback, fixes hard-coded org type) → Tasks 1, 2. ✓
- #2 confirmation prompts / knows-to-type (per-beat placeholders + reworded beats) → Task 3 copy + Task 4 Step 5. ✓
- #3 card after text prints (gate on `shownDone` + delay) → Task 4 Steps 3, 6. ✓
- #4 better copy → Task 3. ✓
- Low-confidence in-voice retry (one shot) → route Task 2 + ChatPanel Task 4 Step 4. ✓
- City echo into the work question → `askWork(cityTitle)` Task 4 Step 4. ✓

**Type consistency:** route returns `{title, entity_type, lowConfidence}`; ChatPanel reads `d.title` / `d.lowConfidence`. `classifySeed` returns `{title, entity_type, confidence}`. `onboardingPlaceholder` keyed by ObStep values (`welcome|howto|consent|location|work|confirm`) — `interview` falls to the non-onboarding branch. `completeOnboarding` unchanged, still imported in the handoff effect.

**Security:** route derives `user` from the cookie session, ignores any body `userId`, writes via the RLS client. No admin/service-role client used.

**Auth note for reviewer:** confirm `POST /api/onboarding/seed` refuses an unauthenticated request (401) and that a logged-in user can only ever write their own rows (RLS). Worth a `security-reviewer` pass since it's a new write route.

# Admin Roadmap Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only `/admin/roadmap` page rendering a checked-in data file of platform areas, each with a core principle and status-tracked items, plus a launch-blocker summary.

**Architecture:** One typed data file (`lib/admin/roadmap.ts`) is the single source of truth; a server component under the existing owner-gated `(admin)` route group renders it. No DB, no client JS. A tiny tsx check script guards data sanity.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript, Tailwind. Spec: `docs/superpowers/specs/2026-07-14-admin-roadmap-tracker-design.md`.

## Global Constraints

- Owner gate must fail closed with `notFound()` (never redirect) — copy the defense-in-depth pattern from `apps/web/app/(admin)/admin/page.tsx:33-36`: the layout gates AND the page re-checks.
- User-facing lexicon does not apply here (owner-only page), but keep the data file's copy consistent with BUSINESS.md framing anyway (find/offer, not "ad", except where naming code like `AdCard`).
- Dark admin styling: `bg-neutral-950` shell, `border-neutral-800`, `bg-neutral-900/50` cards — match the existing dashboard exactly.
- No new dependencies.
- All commands run from `apps/web/` unless noted.

---

### Task 1: Roadmap data file + sanity check

**Files:**
- Create: `apps/web/lib/admin/roadmap.ts`
- Create: `apps/web/scripts/check-roadmap.ts`

**Interfaces:**
- Produces: `ROADMAP: RoadmapArea[]`, `type ItemStatus`, `type RoadmapItem`, `type RoadmapArea` — exported from `@/lib/admin/roadmap`, consumed by Task 2. Exact shapes below.

- [ ] **Step 1: Write the check script first (it is the test)**

Create `apps/web/scripts/check-roadmap.ts`:

```ts
// Sanity check for the roadmap data file. Run: pnpm dlx tsx scripts/check-roadmap.ts
import { ROADMAP } from "../lib/admin/roadmap"

let failed = false
const fail = (msg: string) => { console.error(`FAIL: ${msg}`); failed = true }

if (ROADMAP.length === 0) fail("ROADMAP is empty")
const names = new Set<string>()
for (const area of ROADMAP) {
  if (!area.name.trim()) fail("area with empty name")
  if (names.has(area.name)) fail(`duplicate area name: ${area.name}`)
  names.add(area.name)
  if (area.principle.trim().length < 40) fail(`${area.name}: principle missing or too thin`)
  if (area.items.length === 0) fail(`${area.name}: no items`)
  for (const item of area.items) {
    if (!item.title.trim()) fail(`${area.name}: item with empty title`)
  }
}

if (failed) process.exit(1)
console.log(`OK: ${ROADMAP.length} areas, ${ROADMAP.reduce((n, a) => n + a.items.length, 0)} items`)
```

- [ ] **Step 2: Run it to verify it fails (module missing)**

Run from `apps/web/`: `pnpm dlx tsx scripts/check-roadmap.ts`
Expected: FAIL — cannot find module `../lib/admin/roadmap`.

- [ ] **Step 3: Create the data file with the full seeded content**

Create `apps/web/lib/admin/roadmap.ts` with exactly this content (statuses seeded from CLAUDE.md session state; owner corrects over time):

```ts
// Build-tracker source of truth, rendered read-only at /admin/roadmap.
// Update this file whenever session work changes an item's state — same
// discipline as CLAUDE.md. No DB, no edit UI; git is the history.

export type ItemStatus = "done" | "built-unverified" | "in-progress" | "planned" | "blocked"

export type RoadmapItem = {
  title: string
  status: ItemStatus
  note?: string // one line of context
  doc?: string // repo-relative path to the spec/plan (display only, not linked)
  launchBlocker?: boolean
}

export type RoadmapArea = {
  name: string
  principle: string // 2–3 sentences: the core principle behind this area
  items: RoadmapItem[]
}

export const ROADMAP: RoadmapArea[] = [
  {
    name: "Onboarding",
    principle:
      "Deterministic 7-beat client flow — no LLM for beats 1–6, so the first minutes can never degenerate. The data contract is transparent up front: the interview builds a profile, the profile powers tailored finds, the user controls what they see and when. Two real nodes are seeded before handoff to the interviewer.",
    items: [
      {
        title: "Deterministic 7-beat flow in ChatPanel",
        status: "built-unverified",
        note: "Owner live drive pending: /hype-reset → all 7 beats → nodes pop → onboarded persists",
        doc: "docs/superpowers/specs/2026-07-12-onboarding-redesign-design.md",
      },
      {
        title: "Server-side node seeding (POST /api/onboarding/seed)",
        status: "built-unverified",
        note: "Structured Gemini classify (temp 0) + regex fallback; one in-voice retry for vague work answers",
      },
      {
        title: "Consent beat with ExampleConsentCard",
        status: "built-unverified",
        note: "Translucent sample ask, ghosted Yes/Not now, revealed after the line prints",
      },
      { title: "Onboarding copy refinement", status: "in-progress", note: "Owner owes a better draft" },
      {
        title: "Confirm-beat stray-Enter blank (~900ms window)",
        status: "planned",
        note: "Minor, self-recovers; fix if it survives the live drive",
      },
    ],
  },
  {
    name: "Interviewer (chat)",
    principle:
      "The product's voice is an interviewer that remembers you — it recalls the whole vault, asks the next good question, and stays in character: tasks and code are deflected, recall and shopping asks are engaged. Gemini 2.5 Flash primary with Cerebras fallback; streaming is opt-in ndjson so mobile and card paths stay plain JSON.",
    items: [
      { title: "Gemini primary + Cerebras fallback (chat + extraction)", status: "done" },
      {
        title: "Vault-wide recall (top-20 full + titles index)",
        status: "built-unverified",
        note: "Live check pending",
        doc: "docs/reviews/2026-07-11-traction-review.md",
      },
      {
        title: "Persona carve-outs (recall/shopping engage, tasks deflect)",
        status: "built-unverified",
        note: "3 persona probes pending",
      },
      {
        title: "Opt-in ndjson streaming",
        status: "built-unverified",
        note: "Streamed turn + reload persistence check pending",
      },
      {
        title: "Dated-event opener (14-day window, exactly once)",
        status: "done",
        note: "Live-verified session 21",
        doc: "docs/graph/2026-07-10-scheduled-events-and-location.md",
      },
      {
        title: "Persona confirm-before-ending + farewell carryover",
        status: "planned",
        note: "Extraction live-test open item",
      },
    ],
  },
  {
    name: "Extraction & vault",
    principle:
      "Dual-layer memory: Postgres is the source of truth, the Obsidian-compatible markdown vault is the AI/human-readable layer. Every note is a graph node and every wikilink an edge. Extraction is a separate structured-output pass, run async off the chat turn, governed by tiered entity types and the gravity agenda.",
    items: [
      { title: "Structured extraction pass (synthesize.ts)", status: "done" },
      {
        title: "Entity resolution: dedup + tier-1 + persistence fixes",
        status: "built-unverified",
        note: "Merged 2026-07-02; live acceptance test pending",
      },
      {
        title: "Whole-vault title dedup",
        status: "built-unverified",
        note: "Watch refines-relation quality next live extraction test",
      },
      {
        title: "Narrow item→place relation",
        status: "planned",
        note: "Intent items pick up a stray link to the mall, not just the stores",
      },
      { title: "Vault export (hype-vault.zip)", status: "done" },
    ],
  },
  {
    name: "Graph & visualization",
    principle:
      "The graph IS the home screen — users watch their knowledge grow as they talk. Custom D3 force simulation rooted at the You node (_profile.md); node colors flow from one palette source of truth; the Gardener keeps the whole graph tidy with soft, logged, reversible batch cleanup.",
    items: [
      { title: "D3 graph canvas + settings + palettes", status: "done" },
      { title: "You-node bloom (fresh vault)", status: "built-unverified", note: "Live check pending" },
      { title: "Share-my-graph PNG", status: "built-unverified", note: "Live check pending" },
      {
        title: "Gardener batch cleanup (reconcile.ts)",
        status: "done",
        note: "Verified session 21; run via scripts/reconcile.ts (--apply to mutate)",
        doc: "docs/graph/2026-07-10-graph-refinement-and-gardener-plan.md",
      },
      {
        title: "Admin 'Tidy graph' button (preview → apply)",
        status: "planned",
        note: "Owner-gated POST /api/admin/reconcile",
      },
      { title: "Per-user daily Gardener cron", status: "planned" },
    ],
  },
  {
    name: "Node structure principles",
    principle:
      "Categories are fixed; brands are cross-linked; attributes live inside content_md, never as nodes. Containment and tier rules come from the engineering canon — the graph stays legible because not everything deserves to be a node.",
    items: [
      { title: "7 entity types with tier 1/2/3 parameter stacks", status: "done", doc: "docs/engineering-canon.md" },
      { title: "Gravity agenda + containment rules", status: "done", doc: "docs/engineering-canon.md" },
      { title: "Root You-node contract (_profile.md, topic Profile)", status: "done" },
    ],
  },
  {
    name: "Finds (offers & revenue)",
    principle:
      "Finds are a core product value, not a monetization story — hyper-tailored suggestions from real interests, with full transparency. Consent is per-moment in chat: the assistant asks each time, never a toggle or settings page. User-facing lexicon is find/offer/suggestion — never 'ad'. Affiliates day one, direct deals at scale.",
    items: [
      { title: "Offer card (AdCard, kind ad|scout)", status: "done" },
      {
        title: "Scout digest (welcome-back local finds)",
        status: "built-unverified",
        note: "Inert until SCOUT_TICKETMASTER_KEY; live test staged (Giessen seeded)",
        doc: "docs/scout/2026-07-08-scout-digest-plan.md",
      },
      {
        title: "Affiliate links (Amazon / Ticketmaster / Booking)",
        status: "planned",
        note: "Day-one revenue, no advertiser deals needed",
      },
      { title: "Yes-gated sponsored path + sponsor sourcing", status: "planned" },
      {
        title: "Revenue validation (find-moment / yes / click rates)",
        status: "planned",
        doc: "docs/gtm/2026-07-13-revenue-validation-plan.md",
      },
      { title: "Bandsintown artist tours", status: "blocked", note: "Waiting on Bandsintown API access" },
    ],
  },
  {
    name: "Mobile app",
    principle:
      "Same backend, thinner shell: Expo + Skia graph reusing packages/shared and the web's bearer-JWT /api/chat. The phone is where the daily conversation habit lives — core loop first, polish second, store builds last.",
    items: [
      {
        title: "Core loop (login → Skia graph → chat → nodes grow)",
        status: "done",
        note: "Verified on physical Android device (session 20)",
        doc: "docs/mobile/2026-07-06-mobile-app-plan.md",
      },
      { title: "Polish punch list", status: "planned", note: "Owner has a points-to-improve list to capture" },
      {
        title: "Standalone preview APK (EAS)",
        status: "planned",
        note: "Needs EXPO_PUBLIC_* as EAS env + a deployed web URL",
      },
      {
        title: "Push notifications + email reminders",
        status: "planned",
        note: "Owner decision before shipping",
      },
    ],
  },
  {
    name: "Landing page",
    principle:
      "Portal-style page that sells 'it remembers you' and finds-as-value; free is a footnote, never the pitch ('free because…' is banned). Lexicon-clean, waitlist-first — the page's one job is a signup.",
    items: [
      {
        title: "Portal-style 11-block rebuild + waitlist API",
        status: "done",
        note: "Session 24; waitlist table migration applied",
        doc: "docs/superpowers/specs/2026-07-13-landing-portal-style-design.md",
      },
      { title: "FounderMemo rewrite", status: "in-progress", note: "Owner content pass" },
      { title: "Real graph screenshot in hero app-card", status: "planned" },
      { title: "Headline / statement copy review", status: "planned" },
      { title: "layout.tsx metadata + OG tags", status: "planned" },
      { title: "Confirm personal Gmail as Contact link", status: "planned" },
    ],
  },
  {
    name: "Marketing & socials",
    principle:
      "The product is its own best asset: a growing personal graph is inherently shareable. Positioning leads with 'it remembers you' and finds as value; public language never says 'ad'. This area is owner-owned — items below are placeholders to correct.",
    items: [
      { title: "X/Twitter presence + build-in-public thread", status: "planned" },
      { title: "Short-form video of a graph growing (TikTok / Reels)", status: "planned" },
      { title: "Product Hunt launch", status: "planned" },
      { title: "Waitlist nurture email(s)", status: "planned" },
      { title: "Share-PNG viral loop measurement", status: "planned" },
    ],
  },
  {
    name: "Launch ops",
    principle:
      "Everything between code-complete and public: privacy, deletion, deployment, keys, validation. Nothing ships that violates the security rules (service key server-only, RLS everywhere) or GDPR basics.",
    items: [
      {
        title: "Delete-account GDPR wiring",
        status: "planned",
        note: "Currently a disabled placeholder in UserMenu",
        launchBlocker: true,
      },
      { title: "Privacy / legal copy", status: "planned", launchBlocker: true },
      { title: "Vercel deployment", status: "planned", launchBlocker: true },
      { title: "Production env keys (incl. SCOUT_TICKETMASTER_KEY)", status: "planned" },
      { title: "Admin roadmap tracker (this page)", status: "in-progress" },
    ],
  },
]
```

- [ ] **Step 4: Run the check to verify it passes**

Run from `apps/web/`: `pnpm dlx tsx scripts/check-roadmap.ts`
Expected: `OK: 10 areas, 51 items`

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/admin/roadmap.ts apps/web/scripts/check-roadmap.ts
git commit -m "feat(admin): roadmap data file + sanity check script"
```

---

### Task 2: Roadmap page + admin nav

**Files:**
- Create: `apps/web/app/(admin)/admin/roadmap/page.tsx`
- Modify: `apps/web/app/(admin)/admin/layout.tsx` (add nav strip inside the wrapper div, above `{children}`)

**Interfaces:**
- Consumes: `ROADMAP`, `ItemStatus`, `RoadmapItem` from `@/lib/admin/roadmap` (Task 1).

- [ ] **Step 1: Create the page**

Create `apps/web/app/(admin)/admin/roadmap/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ROADMAP, type ItemStatus, type RoadmapItem } from "@/lib/admin/roadmap"

// Defense in depth: the layout gates, but a layout and its page render concurrently,
// so the page re-checks the owner before rendering anything (same pattern as /admin).
export default async function RoadmapPage() {
  const ownerId = process.env.ADMIN_USER_ID
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!ownerId || !user || user.id !== ownerId) notFound()

  const allItems = ROADMAP.flatMap((a) => a.items)
  const counts = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, allItems.filter((i) => i.status === s).length]),
  ) as Record<ItemStatus, number>
  const blockers = allItems.filter((i) => i.launchBlocker)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-semibold">Roadmap</h1>

      <section className="border border-neutral-800 rounded-lg p-4 bg-neutral-900/50 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <StatusChip status={s} />
              <span className="text-neutral-300">{counts[s]}</span>
            </span>
          ))}
        </div>
        <div className="text-sm">
          <span className="text-red-400 font-medium">Launch blockers:</span>{" "}
          {blockers.length === 0 ? (
            <span className="text-neutral-400">none</span>
          ) : (
            <span className="text-neutral-300">{blockers.map((b) => b.title).join(" · ")}</span>
          )}
        </div>
      </section>

      {ROADMAP.map((area) => {
        const done = area.items.filter((i) => i.status === "done").length
        return (
          <section key={area.name} className="border border-neutral-800 rounded-lg bg-neutral-900/50">
            <div className="px-4 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-medium">{area.name}</h2>
                <span className="text-sm text-neutral-500 shrink-0">{done}/{area.items.length} done</span>
              </div>
              <p className="mt-1.5 mb-3 text-sm text-neutral-400 leading-relaxed">{area.principle}</p>
            </div>
            <ul>
              {area.items.map((item) => (
                <ItemRow key={item.title} item={item} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

const STATUS_ORDER: ItemStatus[] = ["done", "built-unverified", "in-progress", "planned", "blocked"]

const STATUS_LABELS: Record<ItemStatus, string> = {
  done: "Done",
  "built-unverified": "Built — unverified",
  "in-progress": "In progress",
  planned: "Planned",
  blocked: "Blocked",
}

const STATUS_STYLES: Record<ItemStatus, string> = {
  done: "bg-emerald-500/15 text-emerald-400",
  "built-unverified": "bg-amber-500/15 text-amber-400",
  "in-progress": "bg-sky-500/15 text-sky-400",
  planned: "bg-neutral-500/15 text-neutral-400",
  blocked: "bg-red-500/15 text-red-400",
}

function StatusChip({ status }: { status: ItemStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}

function ItemRow({ item }: { item: RoadmapItem }) {
  return (
    <li className="border-t border-neutral-800 px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <StatusChip status={item.status} />
      <span className="text-neutral-100">
        {item.title}
        {item.launchBlocker && <span className="ml-2 text-xs text-red-400 font-medium">LAUNCH BLOCKER</span>}
      </span>
      {item.note && <span className="text-neutral-400">{item.note}</span>}
      {item.doc && <span className="text-neutral-600 text-xs font-mono">{item.doc}</span>}
    </li>
  )
}
```

- [ ] **Step 2: Add the nav strip to the admin layout**

In `apps/web/app/(admin)/admin/layout.tsx`, add `import Link from "next/link"` at the top and replace the returned JSX:

```tsx
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <nav className="max-w-6xl mx-auto mb-6 flex gap-4 text-sm text-neutral-400">
        <Link href="/admin" className="hover:text-neutral-100">Dashboard</Link>
        <Link href="/admin/roadmap" className="hover:text-neutral-100">Roadmap</Link>
      </nav>
      {children}
    </div>
  )
```

- [ ] **Step 3: Build to verify**

Run from `apps/web/`: `pnpm build`
Expected: build succeeds; `/admin/roadmap` appears in the route list as dynamic (ƒ).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(admin)/admin/roadmap/page.tsx" "apps/web/app/(admin)/admin/layout.tsx"
git commit -m "feat(admin): roadmap tracker view with per-area principles + launch-blocker strip"
```

---

## Manual verification (owner)

- Logged in as owner: `/admin/roadmap` shows the summary strip, 3 launch blockers, and 10 area cards each opening with its principle paragraph.
- Nav links flip between Dashboard and Roadmap.
- Logged out or as another user: `/admin/roadmap` returns 404.

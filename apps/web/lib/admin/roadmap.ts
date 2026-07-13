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

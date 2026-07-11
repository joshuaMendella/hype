# Traction Review — 2026-07-11

Expert review (business + senior full-stack/AI lens) of what's blocking retention and user growth. Grounded in `app/api/chat/route.ts`, `GraphCanvas.tsx`, `ChatPanel.tsx`, BUSINESS.md, and HYPE_BUSINESS_ASSESSMENT.md.

**Owner triage (2026-07-11):** points 1, 3, 4 → implement now, plus real streaming (if no contract breakage) and the You-node bloom from point 5. Point 2 (push/email) → build before shipping, not now. Point 5 onboarding flow → keep as is. Points 6, 7 → later.

---

## The seven findings

### 1. The persona deflects the requests that ARE the business — **[DONE 2026-07-11]**
`route.ts` system prompt: *"Off-topic requests (help with tasks, code, lookups, recommendations) → 'Not really my thing —' then pivot."*
A user asking "can you recommend running shoes?" is **reactive, verified, consent-native purchase intent** — the strongest signal in the model — and the assistant refuses it. Also: the prompt promises "want me to keep an eye out for deals?" but nothing is wired behind a "yes" (only the `[show-ad]` dev marker + hardcoded Zara card).
**Action:** carve out two exceptions to the deflection rule: (a) recall questions about the user's own vault, (b) shopping/recommendation requests. Consent is inherent — the user initiated.

### 2. Zero pull-back-in channel — **[HOLD: build before shipping]**
Scout digest, dated-event opener, welcome-back logic all fire only *after* the user returns. No email infra, no push, no external trigger. On-brand version: follow through on "want to pick this up tomorrow?" with a push/email that keeps the promise; dated events give a second trigger ("how was the concert?"). Mobile app exists → Expo push. Web → weekly Resend digest doubling as the reflection mechanism (BUSINESS.md principle 10).

### 3. Recall breaks at exactly the tenure where retention matters most — **[DONE 2026-07-11]**
Context injection is `limit(20)` most-recently-updated notes. Past 20 notes, anything not recently touched is invisible — best users get the worst recall, and principle 10's "recall" doctrine fails silently.
**Action:** always inject a titles+type index of the entire vault (cheap on Flash), plus full content for the top-K relevant notes. Later: search box over the vault on the graph page.

### 4. The graph is a Spotify-Wrapped-shaped object nobody can share — **[DONE 2026-07-11]**
The memo prices the referral loop at ~$2 CAC and calls the shared graph "the viral loop" — it doesn't exist. **Action:** "share my graph" stylized image export (anonymized labels optional). Only zero-budget growth mechanic available.

### 5. Time-to-wow: five taps of ceremony before any value — **[PARTIAL: bloom animation DONE 2026-07-11; onboarding flow kept as is]**
Onboarding is 5 acknowledge steps before the first question; extraction is off during all of them; graph polls at 3s/6.5s so a slow extraction blooms silently. Owner decision: onboarding flow stays (the data contract matters), but bloom the **You node with a nice animation** immediately so the graph is never dead during onboarding.

### 6. Voice input — **[LATER]**
The product is "talk to me" and users can only type. Web Speech API is ~50 lines and free; stories arrive 4–5× faster by voice. Highest fact-throughput lever.

### 7. Not deployed, no analytics — **[LATER per owner; memo disagrees, revisit soon]**
No PostHog/Plausible (grep: zero hits). Phase 1 entry criteria is "live URL, analytics wired". Affiliate links are the memo's "one afternoon" and unwired.

## Technical actions

- **Real streaming** — route uses `generateContent` and returns full JSON; ChatPanel fakes streaming word-by-word. Switch to `streamGenerateContent` + SSE. **[DONE 2026-07-11 — opt-in ndjson; mobile JSON contract preserved]**
- **Silent fact loss** — extraction in `after()` with `.catch(console.error)`; a failure loses facts forever. Add one retry + `logEvent`. **[cheap, bundle when touching route.ts]**
- **Extraction eval harness** — ~20 golden transcripts → expected nodes; replaces owner live-testing for prompt changes. **[LATER but high dev-velocity ROI]**
- **Prompt-cache ordering** — per-turn relevance re-sort reshuffles the prompt prefix, defeating Gemini implicit caching. **[note only]**

## Through-line
The interview fills the vault, but only the vault **giving back** — answers, deals, memory, follow-through — makes anyone return. Every giving-back path today is capped at 20 notes, refused by the persona, or waiting on a channel that doesn't exist.

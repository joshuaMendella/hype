# Hype — Business Canon

**This is the single source of truth for what Hype is as a business: its core principles, its lifecycle, and where it currently stands.**
If another document (spec, memo, review, plan) contradicts this file, this file wins — update the other document or mark it superseded. Update this file whenever a principle or lifecycle stage changes, and date the change.

*Last updated: 2026-07-06*

---

## 1. What Hype is

Hype is a personal AI assistant that learns about you through natural conversation and builds a living, visual knowledge graph of your world — the people, places, brands, and things that make you *you*. The graph is the home screen; an Obsidian-compatible markdown vault is the storage. It is free to use. Revenue comes from consent-based conversational advertising: from anything you've chosen to share — a stated need ("my running shoes are falling apart"), a favorite brand, an upcoming trip — the assistant may *ask* whether you want to see a relevant offer, and one exists only if you say yes.

**Category claim:** the first personal assistant where every ad is one you asked for.

**The model, stated straight:** Hype treats finds as a feature, not a fee. People have always wanted what advertising promises: the right deal, the show two towns over, the thing they were about to buy anyway. What they hate is what got bolted on — surveillance and powerlessness. Hype removes both. It knows only what the user chose to tell it, kept in a graph the user can see, correct, and delete. And it asks before every find, so the user, not the advertiser, owns the moment. Advertisers and affiliates pay for consent-confirmed referrals, which is why Hype costs users nothing. Free is a consequence of the model, not the pitch. *(Positioning reframed 2026-07-12 — "finds, not ads": the user-facing word for what Hype surfaces is a **find** (singular, specific; a paid one still carries a clear "Sponsored" label). Internal/ops language keeps "advertising/referrals" — the lexicon rule is user-facing surfaces only.)*

---

## 2. Core principles (the canon)

These are product law, not policy. They don't bend under advertiser pressure, growth pressure, or convenience.

1. **Free forever for users.** No subscription wall, no payment friction. (An ad-free Pro tier may exist someday as a signal of value — never as a gate.)
2. **Consent is per-moment and conversational.** The assistant asks before every single ad, in the flow of conversation. The user says yes or no; "no" costs nothing and the chat moves on. **There is no ad-settings page and no category toggle — by design.** "You asked for every one" must stay literally true. *(Decided 2026-07-05; supersedes the toggle visual in the 2026-07-03 landing spec, review finding #4, and the unused `ad_preferences` column.)*
3. **Total transparency about what we know.** The graph IS the profile — every fact visible, correctable, deletable, exportable. The data contract is the pitch, not fine print.
4. **Advertisers buy referrals, never data.** They receive a click or a conversion event. The user profile never leaves the platform, in any form. (Amazon-retail-media model; also the GDPR posture.)
5. **The vault is portable.** Plain markdown, Obsidian-compatible, export anytime. Users who can leave, don't. Lock-in is never a moat we use.
6. **Ad quality is gated by hard product constraints, not judgment calls:**
   - Max one placement per conversation.
   - **The gate is match quality, not vault size.** An offer fires only on a genuinely pertinent, high-confidence match — a strong match can surface early (a user with a clear need at node 3 is eligible); a large but vague vault may never produce one. *(Changed 2026-07-06; supersedes the earlier "no ads until ~80 nodes / a user with 10 nodes never sees an offer" rule — node count was a crude proxy for the real protection, which is not showing a weak match.)*
   - **Offers may be suggested from any fact the user chose to share — buying intent, brand affinity, location, upcoming events, past purchases — tiered by signal strength.** Hot intent ("my shoes are falling apart") and warm affinity ("you like Zara, there's a sale on") are both valid; every tier is molded to the real user and every offer is consented in the moment. **The line that never bends: facts are never inferred, relevance always is.** An offer is a *suggestion* built on true facts (see principle 7), never a new fact invented to sell against — "you bought Zara" must be something you actually said; "you'll like this Zara offer" is only a suggestion. *(Decided 2026-07-06; supersedes the earlier "explicit intent only, never from inference" rule, which conflated inventing a fact — banned — with inferring relevance from a real one, which is the model.)*
   - **Core health metric: accepted offers per user per month** (offers shown × acceptance rate) — rewards relevance and reach together, so the assistant is neither too shy nor spammy. Acceptance rate ("yes, show me" %) is a **guardrail with a floor**, not the target: if it falls below ~30%, targeting is off — tighten it, don't just ask less. A second **trust guardrail** watches whether users who get more asks retain worse or decline in streaks; a broad, consent-gated model leans on the consent gate, so the gate is measured, not assumed. A floor breach or a trust-signal drop is a P1 incident, not a sales problem. *(Metric changed 2026-07-06; the old "acceptance rate is the core metric" was gameable in both directions — a too-shy assistant games it up, a spammy one drags it down.)*
7. **Extraction accuracy is a trust metric, not just a quality metric.** A hallucinated fact produces a wrong ad and breaks both trust loops at once. No inference without an `inferred: true` flag; users can correct any node.
8. **Sequencing discipline (solo founder):** users → affiliate links → direct advertiser deals → self-serve platform. Never build the later stage before the earlier one has numbers.
9. **Finds are a feature, not a fee — never position them as the price of "free."** Advertising was never the problem; surveillance and powerlessness were, and Hype removes both (see §1, "The model, stated straight"). So the positioning never concedes advertising's own worst frame. Product and marketing lead with the value on both sides — "it remembers you," *and* "finds you'd actually want, only when you ask." Free is a consequence of the model, stated as a footnote, never the pitch. *(Reframed 2026-07-12; supersedes the earlier "consent-only ads is the answer to 'why is it free?'" framing, which — even "stated proudly" — still made the ad the thing you have to justify, i.e. the tax that buys free.)*
10. **The graph must serve the user, not just grow — retention is product law, not a growth tactic.** The first act (watch your graph bloom as you talk) is a one-time thrill that fades as the interview exhausts the easy facts; a mature vault can feel *finished*, and a finished product goes unopened — which starves the ad model exactly at the tenures worth the most. So the *second act* is doctrine: the graph must start **giving back**. Three mechanisms, and unlike the bloom they get *better* as the vault matures (they reward tenure instead of fighting it): **recall** ("what was that coffee place in Lisbon?" — answered from the user's own vault), **proactive utility** (surfacing stored facts and `scheduled_for` events: "your sister's birthday is next week"), and **reflection** ("a year ago you were into X — still?"). *(Added 2026-07-06.)*

---

## 3. How the money works

- **The ad moment:** extraction banks a verified intent → assistant asks in-chat ("want me to pull up a couple of current deals?") → user says yes → one clearly-labeled sponsored card ("Sponsored · you said yes") with an affiliate/tracking link.
- **Phase-one revenue (no advertiser relationships needed):** affiliate links — Amazon Associates (retail), Ticketmaster/Impact (events), Booking.com (travel). Topic→category routing lives in `lib/ads/categories.ts`.
- **Later revenue:** direct CPC ($1.50–3.00) / CPA (8–12%) deals with D2C brands, then a self-serve advertiser dashboard, then programmatic intent-category bidding. Full pricing rationale and unit economics: `HYPE_BUSINESS_ASSESSMENT.md` §4–5.
- **Unit economics headline:** COGS ~$0.15–0.30/user/month; modeled revenue $0.33–1.40/MAU/month; path to $1M ARR at ~60–250K MAU depending on scenario.

---

## 4. Lifecycle

| Phase | Name | Entry criteria | Revenue | Focus |
|---|---|---|---|---|
| **0** | Build & close the loop | — | $0 | Product works end-to-end: interview → graph → intent → ad moment. Privacy policy + account deletion. Deploy. **← WE ARE HERE (2026-07-05)** |
| **1** | Closed beta | Live URL, analytics wired | ~$0 | 15–20 users; prove first-session completion ≥60% and day-3 return. File affiliate applications (approval is the long pole). |
| **2** | Public launch & affiliate revenue | Beta retention holds | First affiliate clicks | Build-in-public, Product Hunt, Show HN. Target: retained hundreds, first "yes, show me" clicks. |
| **3** | Direct advertiser deals | ~10–20K MAU | CPA performance deals | 2–3 hand-picked D2C brands in highest-intent categories. No ad-tech stack. |
| **4** | Self-serve platform | ~50K+ MAU | CPC/CPA/CPM at scale | Advertiser dashboard, category targeting (aggregate reach only — principle 4). Seed round becomes viable here. |

Phase transitions are earned by metrics, never by calendar. Detailed week-one execution: `docs/gtm/2026-07-05-gtm-plan.md`.

---

## 5. Current state

Live project state — what's built, blockers, and what's next — lives in the repo `CLAUDE.md` (its session checklist + "What's NOT done yet"). This file owns principles and lifecycle, not day-to-day status. Sessions 1–20 are logged in `CHANGELOG.md`.

---

## 6. Document map

| Document | Role | Status |
|---|---|---|
| **`BUSINESS.md`** (this file) | Canon: principles, lifecycle, current phase | **Authoritative** |
| `HYPE_BUSINESS_ASSESSMENT.md` | Deep market/competitive/unit-economics memo (2026-06-26) | Reference. Point-in-time analysis; principles herein win on conflict |
| `HYPE_CONCEPT.md` | Product/engineering concept: persona, extraction pipeline | Reference (engineering canon is CLAUDE.md) |
| `docs/gtm/2026-07-05-gtm-plan.md` | Go-to-market execution plan | Active plan |
| `docs/superpowers/specs/2026-07-03-landing-page-design.md` | Landing page spec | Historical; §2 toggle visual **superseded** by per-moment consent (built ConsentPanel shows the real flow) |
| `docs/reviews/2026-07-03-full-project-review.md` | Code+business review | Active punch list; finding #4 (consent toggle) **superseded** |
| `Hype__Suggestions.docx` | Design suggestions (2026-06-27): gravity agenda, tiered params | Historical — implemented in sessions 9–15 |
| `CLAUDE.md` | Engineering context & session state | Authoritative for code/architecture |

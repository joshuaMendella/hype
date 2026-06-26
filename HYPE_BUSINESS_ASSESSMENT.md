# Hype — Business Assessment Memo

**Date**: June 26, 2026  
**Author**: Joshua Mendella  
**Subject**: Market Opportunity, Competitive Landscape & Path to Revenue

---

## Executive Summary

Hype is an AI-powered personal knowledge graph that learns about the user through conversational interviews and builds an Obsidian-compatible vault of linked markdown notes. The graph visualization is the home screen — users watch their knowledge grow as they talk.

The product sits at the intersection of two markets: personal knowledge management (PKM, ~$1.8B, 12–15% CAGR) and digital advertising ($740B+, 10–12% CAGR). The business model is transparent, consent-first conversational advertising. Users know from onboarding exactly how the platform works: the interview builds a personal profile, that profile powers tailored offers, and the user decides what to see and when. This is not a hidden trade-off — it is the pitch.

Hype is free. Advertisers pay for qualified referrals at the exact moment of verified intent. When a user is looking for a new shirt, the interviewer — already holding their size, preferred brands, and budget — offers to surface current deals. If they want them, they see them. If not, the conversation continues. No unsolicited ads. No background tracking. The user accesses ads; ads don't chase the user.

This is a structurally new advertising format. Conversion rates should be 5–10× traditional digital ads because intent is verified, not inferred, and the user is in an active, receptive mindset. The closest public proof of concept is Brave browser's opt-in ad model at $100M ARR, 100M MAU. Hype's targeting depth is an order of magnitude richer; the revenue per engaged user should reflect that.

---

## 1. Market Size

**Total Addressable Market (TAM)**  
The global knowledge management software market was valued at approximately $6.8B in 2025 (enterprise + personal), growing to $13–15B by 2033. The personal/consumer slice — tools like Notion, Obsidian, Mem, and Reflect — is pegged at $1.3–1.8B in 2024–2025 and projected to reach $4.7–4.9B by 2033 (CAGR: 12–15%).

**Serviceable Addressable Market (SAM) — two-sided**  
*User side:* Knowledge workers, self-improvement consumers, and anyone frustrated by irrelevant ads — a broadly reachable segment. Free product = no payment friction, so the addressable user population is far larger than any $10/month subscription would reach.  
*Advertiser side:* Retail, fashion, events, travel, food and beverage, and any brand with a direct purchase funnel. Global digital advertising spend was $740B in 2025. Even niche consent-based placements with 10× conversion rates can command premium CPCs ($2–10) and CPA commissions (8–15% of transaction).

**Serviceable Obtainable Market (SOM) — 3-Year Horizon**  
At $1.00 blended revenue per active user per month (conservative; see Unit Economics):
- 100K MAU → $100K/month → **$1.2M ARR**
- 500K MAU → $500K/month → **$6M ARR**

Brave browser demonstrates $1/MAU/year is achievable with a far less rich targeting signal. Hype should reach $8–12/MAU/year at similar scale once a direct advertiser network is live.

**Tailwinds driving demand:**
- 40% of users now refuse cookies when given a choice — advertisers are actively seeking consent-based alternatives
- Contextual advertising market forecast to surpass $562B by 2030 as behavioral targeting erodes
- Explosion of AI-native tools normalizing "AI knows me" products
- Users fatigued by irrelevant ads are a ready-made audience for "ads you actually want"
- Obsidian's installed base (~1M+ users) as a warm, organic distribution channel

---

## 2. Competitive Landscape

| Product | Approach | Price | AI Depth | Graph UI | Funding |
|---|---|---|---|---|---|
| **Notion AI** | Manual docs + AI assist | $20/user/mo | Ask-based | No | $275M+ raised |
| **Obsidian** | Local-first markdown, manual links | Free + $8/mo sync | Plugin-dependent | Yes | Bootstrapped |
| **Mem** | Auto-organizing notes, AI search | $14.99/mo | Auto-tagging | No | $23.5M (OpenAI Fund) |
| **Reflect** | Backlinked daily notes + AI | $10/mo | AI linking | Basic | Bootstrapped |
| **Logseq** | Outliner + graph, local-first | Free/OSS | Minimal | Yes | Small seed |
| **Limitless AI** | Passive audio capture + AI recall | $19/mo | Retrieval | No | $35M+ raised |
| **Mem0** | Memory API layer for dev tools | Dev API ($0.02/1K ops) | Infrastructure | No | $24M (YC, Peak XV) |
| **Google NotebookLM** | Document Q&A + audio | Free | Grounded retrieval | No | Google-funded |

**Gap in the market:** Every competitor either requires the user to *actively file information* (Notion, Obsidian, Logseq) or passively captures everything and filters it (Limitless). No one runs a structured, goal-directed interview to *extract* and *categorize* facts about the user's life. Hype occupies this position.

---

## 3. Differentiation

**Core thesis:** Most PKM tools are filing systems. Hype is a structured interviewer. The UX inversion — the AI comes to *you* with questions, not the other way around — is the product.

| Dimension | Hype | Everyone Else |
|---|---|---|
| Data entry model | AI interviews you | You write/dump notes |
| Knowledge structure | Auto-built 5-layer graph (You → Topic → Category → Fact → Attribute) | Manual or flat auto-tags |
| Output format | Obsidian-compatible vault (portable) | Proprietary / locked |
| Home screen | The graph itself | A document list |
| Memory durability | Durability rules filter to owned/preferred/routine facts | All noise stored |
| Privacy posture | User controls the vault; markdown = no lock-in | Varies; mostly cloud-locked |
| Data contract | Explicit, upfront, part of the brand promise | Hidden in ToS or not present |
| Ad relationship | User accesses offers on their own terms; ads are opt-in per moment | Forced, untargeted, interruptive |

**Defensible moats (in order of build time):**
1. **Extraction quality** — The 5-layer pipeline with no-inference rules is a durable, hard-to-clone data layer. Every competitor that adds "AI auto-organization" collapses facts into tags; Hype builds a semantic graph.
2. **Interview corpus** — Over time, conversation history + interview strategy becomes a training dataset and moat. The interviewer learns what to ask next.
3. **Vault portability** — Obsidian compatibility is a trust signal that pulls users who reject lock-in. This is a counter-positioning move against Notion.
4. **Graph home screen** — Visceral, visual feedback loop that competitors focused on text list UIs can't easily replicate without a full rebuild.

---

## 4. Monetization

**Model: Free to users. Revenue from advertisers.**

The product is free forever. There is no subscription wall. Revenue comes entirely from the advertiser side of the marketplace — brands pay for qualified referrals delivered at the moment of expressed intent.

**The data contract is explicit and front-and-center.** Users are told at onboarding exactly how the platform works: the interview builds a personal profile, that profile powers personalized offers, and the user controls what they see and when. This is not fine print — it is the pitch. The value exchange is transparent by design: *"Tell us who you are, and we'll make sure the commercial world reflects the real you, on your terms."*

**How a placement works:**
1. Extraction pipeline detects a relevant intent node (e.g. user wants a new shirt, size M, prefers Levi's, budget ~$80)
2. Interviewer checks the advertiser catalogue for matching offers
3. Interviewer offers naturally: *"I've got your preferences saved — want me to pull up some current shirt offers?"*
4. User says yes → sponsored card appears with offer + affiliate/tracking link
5. Advertiser is billed on click or conversion; Hype keeps 100% of that revenue

**Advertiser pricing tiers:**

| Format | Billing | Rate (est.) | Rationale |
|---|---|---|---|
| **CPC — standard** | Per click | $1.50–3.00 | 3–5× Google Shopping; justified by explicit user consent |
| **CPA — retail** | % of transaction | 8–12% | Affiliate model; aligns incentives with advertiser |
| **CPA — events / tickets** | Per ticket sold | $3–8 flat | Similar to Ticketmaster affiliate program |
| **CPM — brand awareness** | Per 1,000 card impressions | $25–60 | Premium; user opted in to see the card |

**Why advertisers pay more per action:**
- Intent is *verified*, not inferred from browser history
- User actively said "yes" — this is not an interruption, it's a request
- Targeting depth is unmatched: brand preferences, price range, size, past purchases, lifestyle — all explicit facts, not probabilistic signals
- Conversion rates should be 5–10× traditional display; even 2× justifies a 3× price premium

**Key brand promise to users:** *"Be in control of your ads. Only see what you want, when you want it. The real you gets the real offers."*

**Advertiser go-to-market sequence:**
1. **Phase 1 (0–10K users):** No ads yet. Build the vault. Prove retention.
2. **Phase 2 (10K–50K users):** Hand-pick 3–5 brand partners in high-intent categories (fashion, events, travel). Manual deals, affiliate links. No ad tech stack needed.
3. **Phase 3 (50K+ users):** Build a self-serve advertiser dashboard. Launch category-level targeting. Hire one sales person focused on D2C brands.
4. **Phase 4:** Programmatic API — allow brands to bid on intent categories in real time. This is the long-term platform play.

**Secondary revenue (future, not now):**
- **Ad-free Pro tier** ($5–8/month) — for users who want zero commercial moments. Small segment; signals that the free tier has real value.
- **Vault export / API** — developer access to the extraction pipeline
- **Enterprise memory** — teams sharing a knowledge graph; B2B wedge

---

## 5. Unit Economics

**Cost side — AI infrastructure (Groq Llama 3.3 70B):**

| Usage level | Tokens/month | Monthly AI cost/user |
|---|---|---|
| Light (2–3 sessions/week) | ~15K input / 10K output | ~$0.017 |
| Active (daily) | ~50K input / 35K output | ~$0.057 |
| Heavy + extraction (Anthropic Sonnet, 5×/month) | +10K extraction tokens | +$0.18 |

| Metric | Per user/month |
|---|---|
| Blended AI cost | $0.10–$0.25 |
| Supabase + Vercel (amortized at scale) | ~$0.05 |
| **Total COGS/user/month** | **$0.15–$0.30** |

COGS are near-zero. The heavy-user tail (top 5% driving 75% of compute) is the only cost risk; soft session throttling handles it without degrading the product for 95% of users.

**Revenue side — advertiser model:**

| Metric | Conservative | Optimistic |
|---|---|---|
| % of MAU with ≥1 relevant ad moment/month | 25% | 50% |
| % of those who say "yes, show me" | 50% | 70% |
| Click-through rate on shown offer | 35% | 55% |
| Avg CPC from advertiser | $1.50 | $3.00 |
| Avg CPA events (additional) | $4.00 | $8.00 |
| **Blended revenue/MAU/month** | **$0.33** | **$1.40** |

At 500K MAU: $165K–$700K/month → **$2M–$8.4M ARR**

> Brave browser benchmark: ~$1/MAU/year with passive, lower-intent opt-in ads. Hype's model should produce $4–12/MAU/year because intent is explicit, verified, and conversationally confirmed. The gap narrows Brave's $100M ARR example to a directional floor, not a ceiling.

**Contribution margin per MAU:**

| Scenario | Revenue/user/mo | COGS/user/mo | Contribution |
|---|---|---|---|
| Conservative | $0.33 | $0.25 | $0.08 (24%) |
| Base case | $0.75 | $0.20 | $0.55 (73%) |
| Optimistic | $1.40 | $0.20 | $1.20 (86%) |

Contribution margin improves with scale as fixed infra costs (Supabase, Vercel) amortize across more users. The real scale lever is advertiser demand: more brands competing for placements raises effective CPC without touching costs.

**Path to $1M ARR:**
- Conservative model: ~250K MAU
- Base case: ~112K MAU
- Optimistic: ~60K MAU

Without a subscription paywall, reaching 100K+ MAU in 12–18 months is plausible with organic + community growth. This is the structural advantage of the free model: the funnel is wider by default.

**CAC dynamics (free product):**

| Channel | CAC | Notes |
|---|---|---|
| Organic / community | $0–5 | Obsidian forums, Reddit PKM, ProductHunt |
| Referral / share graph | ~$2 | Shared graph view is the viral loop |
| Paid social | $8–25 | Lower than subscription apps; no payment friction |

Free products convert at 5–15× the rate of paywalled products at the top of the funnel. CAC is structurally lower because you're not asking for a credit card to try.

---

## 6. Key Risks

**P1 — Execution gap between the promise and the experience**  
The brand promise is explicit: *you are in control, ads are tailored to the real you, nothing is forced.* The risk is not that users discover the business model — they know it. The risk is that the experience doesn't live up to it. A poorly matched offer, an offer surfaced too early in the relationship (vault too thin to know you well), or an offer that appears too frequently — any of these breaks the promise even though the contract was transparent. *Mitigation:* Gate ad moments behind vault maturity. A user with 10 fact nodes should never see a sponsored offer; a user with 80+ should see only highly confident matches. Offer quality is a product metric, not a sales metric.

**P2 — Platform integrity under advertiser pressure**  
As advertiser revenue grows, there will be pressure to increase placement frequency, lower targeting thresholds, or favor high-paying advertisers over relevance. This is how every ad-supported platform has eventually degraded (Google Search quality, Instagram feed). *Mitigation:* Hard product constraints, not policies: cap placements per session (e.g., max 1 per conversation), enforce a minimum confidence score for the vault match, and make the acceptance rate visible internally as a health metric. If acceptance rate drops, it means quality dropped — treat it like a P1 incident.

**P3 — Advertiser cold-start**  
No users = no advertisers. No advertisers = no revenue. Until ~10K MAU, there's no pitch to an advertiser worth making. The risk is running out of motivation/resources during the user-growth phase before revenue appears. *Mitigation:* Use affiliate links (Amazon Associates, Ticketmaster affiliate, etc.) as a bridge — no direct advertiser relationship needed, revenue from day one. Swap in direct deals at 10–50K MAU.

**P4 — Regulatory (GDPR / CCPA)**  
Even consent-based advertising is regulated. Selling behavioral profiles to advertisers — even in aggregated or anonymized form — triggers data protection laws in the EU and California. *Mitigation:* The correct model is Hype *matches* user intent to advertiser offers inside the platform and sends advertisers only a click or conversion event — never the raw user profile. Advertisers buy referrals, not data. This is architecturally the same as Amazon's retail media network: Amazon doesn't sell your purchase history; it sells placement. Get a lawyer before signing any advertiser contract.

**P5 — Big-tech encirclement**  
Apple Intelligence, Google Gemini, and Microsoft Copilot are building personal memory layers. A free "OS-level assistant that shows you relevant offers" from Apple is a plausible 3–5 year threat. *Mitigation:* Apple's model is passive recall, not structured interview. Hype's vault is portable markdown — Apple's data stays on-device and locked to their ecosystem. The user-in-control brand is the counter-positioning Apple structurally cannot match (because Apple's business model also depends on App Store ad revenue from the same advertisers).

**P6 — AI extraction quality**  
A hallucinated fact generates a bad ad placement ("you said you wanted blue shoes" when the user said brown). This destroys both trust loops simultaneously — vault trust and ad trust. *Mitigation:* Flag extraction confidence. Only trigger ad moments from high-confidence facts. Let users correct nodes. Extraction accuracy is a first-class product metric.

**P7 — Solo founder sequencing**  
Users → affiliate revenue → direct advertisers is the right sequence. Skipping ahead to build an ad tech stack before 10K MAU is wasted effort. *Mitigation:* Affiliate links are a one-afternoon implementation. Direct advertiser deals are a conversation. Neither requires building a DSP.

**P8 — LLM vendor risk**  
Groq is single-vendor. If pricing spikes, margins compress immediately since users pay nothing. *Mitigation:* Wrap the `groq` call behind a provider interface before growth. Switching should be a config change.

---

## 7. Next Steps (Sequenced)

### Immediate (weeks 1–4)
1. **Ship the landing page** at `/` — lead with the user value prop: *"Only see the ads you actually want."* Email capture. No subscription required.
2. **Deploy to Vercel** — no distribution without a live URL.
3. **Wire up affiliate links** — Amazon Associates (retail/fashion), Ticketmaster affiliate (events), Booking.com (travel). This is the Day 1 revenue engine. Zero advertiser relationship needed. One afternoon to implement.

### Short-term (months 1–3)
4. **Instrument retention** — Posthog or Plausible. Key metrics: graph nodes/user, sessions/week, ad moments triggered, ad moments accepted (acceptance rate is the core ad product health metric).
5. **Build the ad moment UI** — a distinct, clearly-labeled "sponsored offer" card inside the chat. Must feel like a recommendation, not a banner. Transparency is trust: always label it as sponsored.
6. **Post the Obsidian community** — free distribution. Frame as "Obsidian-compatible AI interviewer that builds your personal graph."
7. **LLM provider abstraction** — wrap `groq` behind a provider interface. One config change to switch providers.

### Medium-term (months 3–6)
8. **First direct advertiser deal** — at 10–20K MAU, approach 2–3 D2C brands in the highest-intent categories your vault data shows (fashion? events? food?). A performance deal (CPA only, no upfront) is low-risk for both sides.
9. **Mobile app (Expo)** — after the ad model is validated on web. Mobile means push notification check-ins ("Ready for your next session?"), which dramatically increases session frequency and therefore ad moment frequency.
10. **Vault export (zip download)** — trust signal. Users who can leave, don't.

### Longer-term (6–18 months)
11. **Self-serve advertiser dashboard** — at 50K+ MAU, inbound advertiser interest justifies a portal. Category-level targeting (e.g., "fashion, women 25–40, budget $50–150"). Advertisers never see user profiles — only aggregate category reach.
12. **Ad-free Pro tier** ($5–8/month) — for users who prefer no commercial moments. Small segment, signals the free tier has genuine value.
13. **Raise a seed round** — the pitch at this stage: "consent-based conversational advertising with verified purchase intent; Brave browser is the $100M comps, we're doing it with 10× the targeting depth."

---

## Summary Scorecard

| Dimension | Assessment | Rating |
|---|---|---|
| Market size | PKM ($1.8B) + digital advertising ($740B); two-sided market with massive advertiser TAM | ★★★★★ |
| Differentiation | Consent-based conversational advertising is a structurally new format; no direct competitor | ★★★★★ |
| Competitive moat | Extraction depth + advertiser network effects over time; moat thin early, compounding at scale | ★★★☆☆ |
| Unit economics | COGS ~$0.20/user/month; revenue $0.33–1.40/MAU/month; margins expand with advertiser competition | ★★★★☆ |
| Monetization clarity | Affiliate links on day one → direct deals at 10K MAU → self-serve at 50K MAU; clear sequence | ★★★★☆ |
| Trust risk | Interviewer-as-data-miner perception is existential; mitigated by design, not by policy | ★★☆☆☆ |
| Execution risk | Solo founder; sequencing to 10K MAU before advertiser focus is the critical discipline | ★★★☆☆ |
| Overall | **Genuinely novel ad format on top of a genuinely novel product — high upside, high trust dependency** | ★★★★☆ |

---

*The shortest path to proof: landing page → Vercel → affiliate links → 10K MAU → first direct advertiser deal → iterate. The business model only becomes real when a user says "yes, show me the offer" for the first time and clicks through. Build toward that moment.*

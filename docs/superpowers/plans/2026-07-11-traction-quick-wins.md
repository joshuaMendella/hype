# Traction Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four approved workstreams from `docs/reviews/2026-07-11-traction-review.md`: vault-wide recall, persona carve-outs (recall + shopping), real streaming replies, You-node bloom animation, and share-my-graph image export.

**Architecture:** All server work lives in `apps/web/app/api/chat/route.ts` (prompt text, context assembly, streaming). Pure logic is extracted to `lib/ai/vaultContext.ts` so it's checkable outside Next. Client work: `ChatPanel.tsx` (stream reader), `GraphCanvas.tsx` (bloom + share button), new `lib/graph/shareImage.ts` (SVG→PNG export). Streaming is **opt-in via `stream: true` in the request body** — the mobile app and every card/onboarding path keep today's JSON contract byte-for-byte.

**Tech Stack:** Next.js 16 route handlers, Gemini `streamGenerateContent?alt=sse`, ndjson over `ReadableStream`, D3 v7 transitions, Canvas 2D + `XMLSerializer` for export. **No new dependencies.**

## Global Constraints

- Ponytail full: shortest working diff, no speculative abstraction, no new deps.
- The mobile app posts to `/api/chat` **without** `stream` → must receive exactly today's JSON shape (`{reply}` / `{reply, card}` / `{error}`).
- Onboarding path (JSON schema), ad short-circuits, and scout-card openers **never stream**.
- No test framework exists — verification = `pnpm build` from `apps/web`, tsx check scripts in `apps/web/scripts/`, and specified manual checks.
- Never touch `.env.local` / `.mcp.json`; admin client only in `app/api/`.
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Run all commands from `apps/web` unless stated. Build: `pnpm build`. Dev: `pnpm dev`.
- Line numbers below refer to the file state at commit `bfa886c` and shift as tasks land — match on the quoted code, not the number.

---

### Task 1: Vault-wide recall context

**Files:**
- Create: `apps/web/lib/ai/vaultContext.ts`
- Create: `apps/web/scripts/check-vault-context.ts`
- Modify: `apps/web/app/api/chat/route.ts` (vault query ~line 382, context block ~lines 440–478)

**Interfaces:**
- Produces: `buildVaultContext(notes: VaultContextNote[], agenda: AgendaLike): string` and `FULL_CONTENT_COUNT = 20`, imported by the chat route. `VaultContextNote = { title: string; topic: string | null; content_md: string | null; entity_type: string | null }`.
- Consumes: nothing from other tasks. Task 2's prompt text refers to "titles-only entries", which this task creates.

- [ ] **Step 1: Create `apps/web/lib/ai/vaultContext.ts`**

```ts
// Interviewer vault context: full content for the K most relevant notes, a compact
// titles-only index for everything else. Full-vault visibility is what makes recall
// work past the first 20 notes (traction review 2026-07-11, finding #3).

export type VaultContextNote = {
  title: string
  topic: string | null
  content_md: string | null
  entity_type: string | null
}

export type AgendaLike = {
  current: { title: string; tags?: string[] } | null
  pending: Array<{ title: string }>
}

export const FULL_CONTENT_COUNT = 20

// Notes arrive most-recently-updated first; the relevance sort is stable, so ties keep
// recency order — identical top-20 behavior to the pre-index implementation.
export function buildVaultContext(notes: VaultContextNote[], agenda: AgendaLike): string {
  const currentTitle = agenda.current?.title?.toLowerCase()
  const currentTags = new Set((agenda.current?.tags ?? []).map((t) => t.toLowerCase()))
  const pendingTitles = new Set(agenda.pending.map((p) => p.title.toLowerCase()))
  const relevance = (n: VaultContextNote) => {
    const t = n.title.toLowerCase()
    if (currentTitle && t === currentTitle) return 3
    if (pendingTitles.has(t)) return 2
    if (n.topic && currentTags.has(n.topic.toLowerCase())) return 1
    return 0
  }

  const withContent = notes.filter((n) => n.content_md?.trim())
  const ordered = [...withContent].sort((a, b) => relevance(b) - relevance(a))
  const full = ordered.slice(0, FULL_CONTENT_COUNT)
  const fullTitles = new Set(full.map((n) => n.title))
  // The index covers every note not shown in full — including content-less ones;
  // knowing a node exists is exactly what recall needs.
  const indexed = notes.filter((n) => !fullTitles.has(n.title))

  const fullBlock = full
    .map((n) => `### ${n.topic ? `[${n.topic}] ` : ""}${n.title}\n${n.content_md}`)
    .join("\n\n")
  if (!indexed.length) return fullBlock

  const indexBlock = indexed
    .map((n) => `- ${n.title}${n.entity_type ? ` (${n.entity_type})` : ""}${n.topic ? ` [${n.topic}]` : ""}`)
    .join("\n")
  const indexSection = `#### Everything else in their vault (titles only — you remember these exist; recall or weave them in when relevant, never re-ask them):\n${indexBlock}`
  return fullBlock ? `${fullBlock}\n\n${indexSection}` : indexSection
}
```

- [ ] **Step 2: Create the check script `apps/web/scripts/check-vault-context.ts`**

```ts
import assert from "node:assert"
import { buildVaultContext, type VaultContextNote } from "../lib/ai/vaultContext"

const note = (i: number, over: Partial<VaultContextNote> = {}): VaultContextNote => ({
  title: `Note ${i}`,
  topic: "Food & Drink",
  content_md: `content ${i}`,
  entity_type: "place",
  ...over,
})
const emptyAgenda = { current: null, pending: [] }

// 1) small vault: everything in full, no index section
{
  const out = buildVaultContext([note(1), note(2)], emptyAgenda)
  assert(out.includes("### [Food & Drink] Note 1\ncontent 1"), "full block missing")
  assert(!out.includes("Everything else"), "index should not appear under 20 notes")
}

// 2) >20 notes: first 20 full, the rest indexed as title lines
{
  const notes = Array.from({ length: 25 }, (_, i) => note(i))
  const out = buildVaultContext(notes, emptyAgenda)
  assert(out.includes("Everything else in their vault"), "index section missing")
  assert(out.includes("- Note 24 (place) [Food & Drink]"), "index line missing")
  assert(!out.includes("### [Food & Drink] Note 24"), "note 24 must not be a full block")
}

// 3) agenda relevance pulls a late note into the full window
{
  const notes = Array.from({ length: 25 }, (_, i) => note(i))
  const out = buildVaultContext(notes, { current: { title: "Note 24", tags: [] }, pending: [] })
  assert(out.includes("### [Food & Drink] Note 24\ncontent 24"), "agenda note not promoted to full")
}

// 4) content-less notes land in the index, never as full blocks
{
  const notes = [...Array.from({ length: 20 }, (_, i) => note(i)), note(99, { content_md: null })]
  const out = buildVaultContext(notes, emptyAgenda)
  assert(out.includes("- Note 99 (place) [Food & Drink]"), "content-less note missing from index")
  assert(!out.includes("### [Food & Drink] Note 99"), "content-less note must not be a full block")
}

console.log("vault-context checks passed")
```

- [ ] **Step 3: Run the check — expect failure-free output**

Run (from `apps/web`): `pnpm dlx tsx scripts/check-vault-context.ts`
Expected: `vault-context checks passed`

- [ ] **Step 4: Wire the route.** In `apps/web/app/api/chat/route.ts`:

4a. Add the import at the top with the other `@/lib/ai` imports:

```ts
import { buildVaultContext } from "@/lib/ai/vaultContext"
```

4b. In the parallel fetch block, change the vault query's limit from 20 to 500 (safety cap only — the helper decides what gets full content). Replace:

```ts
    supabase
      .from("vault_notes")
      .select("title, topic, content_md, entity_type")
      .eq("user_id", user.id)
      .is("archived_at", null) // don't hand the interviewer a gardener-archived node as live context
      .order("updated_at", { ascending: false })
      .limit(20),
```

with:

```ts
    supabase
      .from("vault_notes")
      .select("title, topic, content_md, entity_type")
      .eq("user_id", user.id)
      .is("archived_at", null) // don't hand the interviewer a gardener-archived node as live context
      .order("updated_at", { ascending: false })
      // Whole vault (capped): top-20 by relevance get full content, the rest ride as a
      // titles-only index — full-vault visibility is what makes recall work (buildVaultContext).
      .limit(500),
```

4c. Replace the inline ordering/context block (the comment starting `// Order the window so notes tied to what we're talking about lead` down through the `const vaultContext = orderedNotes...join("\n\n")` statement, ~lines 440–462) with:

```ts
  // Top-20 relevant notes in full + titles-only index for the rest — see lib/ai/vaultContext.
  const vaultContext = buildVaultContext(vaultNotes ?? [], agenda)
```

(The `relevance`/`orderedNotes` logic now lives in the helper — delete it here entirely.)

4d. Cap `incompleteThreads` (it now scans the whole vault, not 20 notes). In the `incompleteThreads` chain, insert `.slice(0, 8)` between `.filter(...)` and `.map(...)`:

```ts
  const incompleteThreads = (vaultNotes ?? [])
    // A node is unfinished if flagged incomplete, OR if it slipped in under a placeholder
    // title ("another mall") — the latter has no incomplete flag but still needs a real name,
    // so surface it here to self-heal legacy/leaked junk instead of orphaning it.
    .filter((n) => n.entity_type && (n.content_md?.includes("incomplete: true") || isPlaceholderName(n.title)))
    // Whole-vault scan now — cap it so a backlog can't flood the prompt.
    .slice(0, 8)
    .map((n) => {
```

4e. **Deliberate behavior note (no code change):** `synthesize(...)` and `getScoutFind(...)` already receive `vaultNotes` — they now see the whole vault. For `synthesize` this is an upgrade (dedup against all titles, not just the 20 most recent). Leave as is.

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: compiles with no type errors.

- [ ] **Step 6: Manual check**

With `pnpm dev` running and a logged-in user whose vault has >20 notes (owner's test account does): ask the assistant about an old note not in the recent 20 (e.g. "what was that restaurant I told you about?"). Expected: the reply references it by name instead of claiming ignorance. If the test vault has <20 notes, skip — the check script already covers the logic.

- [ ] **Step 7: Commit**

```bash
git add lib/ai/vaultContext.ts scripts/check-vault-context.ts app/api/chat/route.ts
git commit -m "feat(chat): vault-wide recall — full content top-20 + titles index for the rest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Persona carve-outs — recall + shopping requests

**Files:**
- Modify: `apps/web/app/api/chat/route.ts` (SYSTEM_PROMPT `## Handling unusual input` section, ~lines 215–227)

**Interfaces:**
- Consumes: Task 1's titles-only index (the recall rule references it).
- Produces: prompt text only — no code surface.

- [ ] **Step 1: Replace the off-topic rule.** In `SYSTEM_PROMPT`, replace exactly this block:

```
## Handling unusual input

Off-topic requests (help with tasks, code, lookups, recommendations):
→ "Not really my thing — " then pivot immediately with a graph-filling question.
```

with:

```
## Handling unusual input

Recall questions — anything about their own life or what they've told you ("what was that restaurant I mentioned?", "when's my sister's birthday?", "what size did I say?"):
→ This is core, not off-topic — you're their memory. Answer warmly from "What you already know" below (titles-only entries count: you remember that thing exists even without its details). If you genuinely don't have it, say so honestly ("hmm, you haven't told me that one yet") and let them fill it in.

Shopping and recommendation asks ("can you recommend running shoes?", "any idea where to get X?"):
→ Engage — they're handing you exactly what the vault is for. Give one brief, genuine suggestion or ask the single most useful clarifying detail (budget, use, a brand you already know they like — weave in what you know). Never invent a specific current sale, price, or stock — you can't see live deals mid-chat. "I'll keep an eye out for deals on that" is a fine close.

Other off-topic requests (help with tasks, code, general lookups):
→ "Not really my thing — " then pivot immediately with a graph-filling question.
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: compiles (string-only change; this catches accidental template-literal breakage — the prompt contains no backticks today, keep it that way).

- [ ] **Step 3: Manual check (three probes in one dev session)**

1. "What was that place I mentioned last time?" → answers from vault, does NOT say "not really my thing".
2. "Can you recommend running shoes?" → engages with one suggestion or one clarifying question; no invented sale/price.
3. "Can you write me a Python script?" → still deflects with "Not really my thing —" + pivot.

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat(persona): recall + shopping asks are first-class, not off-topic

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Real streaming (opt-in ndjson; JSON contract untouched)

**Files:**
- Modify: `apps/web/app/api/chat/route.ts`
- Modify: `apps/web/components/chat/ChatPanel.tsx`

**Interfaces:**
- Wire protocol (produced by route, consumed by ChatPanel): request body gains optional `stream?: boolean`. When the server streams, the response is `Content-Type: application/x-ndjson; charset=utf-8`, one JSON object per `\n`-terminated line: `{"t":"text chunk"}`* then `{"done":true}`, or `{"error":true}` terminal on mid-stream failure. When the server does NOT stream (no `stream` flag, onboarding, ad short-circuit, scout card, Gemini stream connect failure), the response is today's `application/json` exactly.
- Client rule: branch on `res.headers.get("content-type")`, never on what was requested.

**Server design (why it's safe):**
- Gemini's stream connection is opened and checked (`res.ok`) BEFORE we commit to an ndjson response — a Gemini failure falls through to the existing JSON path with its Cerebras fallback intact.
- `after()` must be registered while the request scope is alive, but the final reply text only exists once the stream ends. So: register `after()` up front with a deferred promise (`finalReply`), and resolve it from whichever path produces the reply. Every return path must resolve it (null = nothing to persist) or the `after` callback would hang.
- All post-reply work (persist message pair, onboarded flag, farewell status, `event_prompted_at`, extraction) moves into one `finishTurn(reply)` run inside that `after()` for BOTH paths. For the JSON path this shifts DB writes from before-response to just-after-response — nothing reads them in that window (the client resends history from state; reload-restore happens seconds later at minimum).

- [ ] **Step 1: Add the two streaming helpers to route.ts**, directly after the `cerebrasChat` function:

```ts
// Streaming variant — opens Gemini's SSE stream and returns the raw fetch Response.
// Caller checks res.ok BEFORE committing to a streamed reply, so a Gemini failure
// still falls through to the JSON path (Cerebras fallback intact).
async function geminiStreamFetch(system: string, history: ChatMsg[]): Promise<Response> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set")
  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))
  if (contents.length === 0) contents.push({ role: "user", parts: [{ text: "(Start the conversation.)" }] })
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CHAT_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.8, thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: 512 },
      }),
    }
  )
}

// Re-emits Gemini's SSE stream as ndjson lines ({"t":chunk}* then {"done":true}),
// accumulating the full text. resolveFinal feeds the after()-registered finishTurn:
// full text on success, null on mid-stream failure (partial replies are never persisted).
function ndjsonResponse(upstream: ReadableStream<Uint8Array>, resolveFinal: (reply: string | null) => void): Response {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const out = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = ""
      let buf = ""
      const reader = upstream.getReader()
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data:")) continue
            const payload = line.slice(5).trim()
            if (!payload || payload === "[DONE]") continue
            try {
              const text = JSON.parse(payload)?.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                full += text
                controller.enqueue(encoder.encode(JSON.stringify({ t: text }) + "\n"))
              }
            } catch { /* non-JSON keepalive line — skip */ }
          }
        }
        // Empty stream = provider hiccup: signal error instead of persisting nothing —
        // the non-stream path treats an empty reply as a failure too.
        if (full.trim()) {
          resolveFinal(full.trim())
          controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + "\n"))
        } else {
          resolveFinal(null)
          controller.enqueue(encoder.encode(JSON.stringify({ error: true }) + "\n"))
        }
      } catch (err) {
        console.error("[chat] stream failed mid-flight:", err)
        resolveFinal(null)
        controller.enqueue(encoder.encode(JSON.stringify({ error: true }) + "\n"))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(out, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  })
}
```

- [ ] **Step 2: Accept the `stream` flag.** Replace the body destructure:

```ts
  const body = await req.json()
  const { messages } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>
  }
```

with:

```ts
  const body = await req.json()
  const { messages, stream } = body as {
    messages: Array<{ role: "user" | "assistant"; content: string }>
    stream?: boolean
  }
```

- [ ] **Step 3: Restructure the tail of POST.** Replace everything from the comment `// Gemini 2.5 Flash primary; Cerebras gpt-oss-120b fallback.` (just after the `history` construction) to the end of the function with:

```ts
  // ── Post-reply work, shared by both paths ─────────────────────────────────
  // after() must be registered while the request scope is alive, but on the streaming
  // path the final text only exists once the response has been flowing — so register
  // it up front and feed it through this deferred. EVERY return path below must call
  // resolveFinal (null = nothing to persist), or the after() callback would hang.
  let resolveFinal: (reply: string | null) => void = () => {}
  const finalReply = new Promise<string | null>((r) => { resolveFinal = r })
  let onboardingComplete = false

  async function finishTurn(reply: string) {
    const trimmedReply = reply.trim()
    // Sign-off always contains "Talk soon" (system prompt mandates it); wrap-up *proposals*
    // ("want to pick this up tomorrow?") deliberately don't, so they never close prematurely.
    const isFarewell = /talk soon[.!]?\s*$/i.test(trimmedReply) && trimmedReply.length <= 80
    const lastUserMsg = messages.findLast((m) => m.role === "user")
    if (!lastUserMsg || !conversationId) return

    await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "user", content: lastUserMsg.content },
      { conversation_id: conversationId, role: "assistant", content: reply },
    ])
    if (onboardingComplete) {
      await supabase.from("profiles").update({ onboarded: true }).eq("id", user.id)
    }
    if (isFarewell) {
      await supabase.from("conversations").update({ status: "completed" }).eq("id", conversationId)
    }
    // Fire-once: these dated events were injected into this turn's prompt — mark them
    // so they're raised exactly once (RLS "vault_notes: own" covers this update).
    if (todayEvents?.length) {
      await supabase
        .from("vault_notes")
        .update({ event_prompted_at: new Date().toISOString() })
        .in("id", todayEvents.map((e) => e.id))
    }
    // Extraction: separate structured pass over the recent window — never coupled to the
    // conversational reply. Skipped during onboarding. (Already post-response here.)
    if (!isOnboarding) {
      const messagesForExtraction = messages.filter((m) => !isAdFlowMessage(m))
      await synthesize(messagesForExtraction, agenda, vaultNotes ?? [])
        .then((extraction) => extractFacts(conversationId, user.id, extraction))
        .then(() => (isFarewell ? closeSession(conversationId, user.id).then(() => {}) : undefined))
        .catch((err) => console.error("[chat] extraction failed:", err))
    }
  }

  after(async () => {
    const reply = await finalReply
    if (reply != null) await finishTurn(reply)
  })

  // ── Streaming path (opt-in; web client only) ──────────────────────────────
  // Never streams: onboarding (JSON schema contract) or a scout-card opener (card rides
  // in JSON). Ad short-circuits returned above. Mobile sends no stream flag → JSON.
  if (stream === true && !isOnboarding && !scoutFind) {
    const upstream = await geminiStreamFetch(systemPrompt, history).catch(() => null)
    if (upstream?.ok && upstream.body) {
      return ndjsonResponse(upstream.body, resolveFinal)
    }
    console.error("[chat] Gemini stream connect failed, using JSON path:", upstream?.status)
    // fall through — JSON path below retries Gemini non-streaming, then Cerebras.
  }

  // ── JSON path (identical contract to before streaming existed) ────────────
  let raw: string
  try {
    raw = await geminiChat(systemPrompt, history, isOnboarding ? ONBOARDING_SCHEMA : undefined)
  } catch (gemErr) {
    console.error("[chat] Gemini chat failed, falling back to Cerebras:", gemErr)
    logEvent("chat_fallback", { err: String(gemErr) }, user.id)
    try {
      raw = await cerebrasChat(systemPrompt, history)
    } catch (cereErr) {
      console.error("[chat] chat failed (both providers):", cereErr)
      logEvent("chat_failed_both", { err: String(cereErr) }, user.id)
      resolveFinal(null)
      const isRateLimit = String(gemErr).includes(" 429") || String(cereErr).includes(" 429")
      return NextResponse.json({ error: isRateLimit ? "rate_limit" : "chat_error" }, { status: isRateLimit ? 429 : 502 })
    }
  }
  console.log("[chat] raw:", raw.slice(0, 200))

  // Interview path returns plain text. Only onboarding still uses a small JSON contract
  // (reply + onboarding_complete) — no extraction, so the JSON-leak risk is negligible.
  let reply = raw.trim()
  if (isOnboarding) {
    const parseOnboarding = (s: string) => {
      const parsed = JSON.parse(s)
      reply = parsed.reply ?? raw
      onboardingComplete = parsed.onboarding_complete === true
    }
    try {
      parseOnboarding(raw)
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) { try { parseOnboarding(jsonMatch[0]) } catch { /* fall back to raw */ } }
    }
  }
  console.log("[chat] reply:", reply.slice(0, 150))

  resolveFinal(reply)

  const scoutCard: AdCard | undefined = scoutFind
    ? { kind: "scout", title: scoutFind.title, date: scoutFind.date, venue: scoutFind.venue, url: scoutFind.url, source: scoutFind.source }
    : undefined

  return NextResponse.json(scoutCard ? { reply, card: scoutCard } : { reply })
```

**Deletions this replaces:** the old inline `isFarewell` calc, the `if (lastUserMsg && conversationId)` persistence block, the nested `after(...)` extraction call, and the old return — all now inside `finishTurn`/the shared tail. The two ad-flow `persistAdTurn` early-returns above this section are BEFORE the `after()` registration, so they need no `resolveFinal` — verify they still `return NextResponse.json(...)` untouched.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: compiles. Common trip-up: `finishTurn` closes over `conversationId`/`agenda`/`vaultNotes`/`todayEvents` — all already in scope; do not re-declare.

- [ ] **Step 5: Update ChatPanel to read streams.** In `apps/web/components/chat/ChatPanel.tsx`:

5a. Add stream state next to the other `useState` calls:

```ts
  // Current message arrived via stream → bypass the typewriter (text is already incremental).
  const [streamMode, setStreamMode] = useState(false)
  const [streamDone, setStreamDone] = useState(true)
```

5b. Feed the typewriter nothing while in stream mode, and derive what's shown. Replace:

```ts
  const { displayed, done } = useTypewriter(currentAi)
```

with:

```ts
  const { displayed, done } = useTypewriter(streamMode ? "" : currentAi)
  const shownText = streamMode ? currentAi : displayed
  const shownDone = streamMode ? streamDone : done
```

Then in the JSX, replace `{displayed}` with `{shownText}` and both `{!done && (` cursor conditions with `{!shownDone && (` (there is one cursor block — update it).

5c. Replace the body of the `try` block in `send()` (keep the surrounding `try/catch/finally`):

```ts
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, userId, stream: true }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStreamMode(false)
        setCurrentAi(body.error === "rate_limit"
          ? "I've hit my daily message limit — check back in a bit."
          : "Something slipped on my end — want to try that again?")
        return
      }
      const ct = res.headers.get("content-type") ?? ""
      if (ct.includes("application/x-ndjson") && res.body) {
        // Real stream: append chunks as they arrive; typewriter stays out of the way.
        setStreamMode(true)
        setStreamDone(false)
        setLoading(false)
        setAiVisible(true)
        let acc = ""
        let errored = false
        const handleLine = (line: string) => {
          if (!line.trim()) return
          try {
            const evt = JSON.parse(line)
            if (evt.t) { acc += evt.t; setCurrentAi(acc) }
            if (evt.error) errored = true
          } catch { /* torn line — skip */ }
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ""
        for (;;) {
          const { done: rdDone, value } = await reader.read()
          if (rdDone) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          lines.forEach(handleLine)
        }
        handleLine(buf)
        if (!acc) setCurrentAi("Something slipped on my end — want to try that again?") // errored or empty stream
        setStreamDone(true)
        setCanInput(true)
        onReply?.()
      } else {
        // JSON path — onboarding, cards, or stream fallback. Typewriter as before.
        const { reply, card: newCard } = await res.json()
        setStreamMode(false)
        setCurrentAi(reply)
        setCard(newCard ?? null)
        onReply?.()
      }
```

Also update the `catch` block to add `setStreamMode(false)` before `setCurrentAi(...)`, so a network error message uses the typewriter (which also restores `canInput` via its `done` effect).

5d. The `useEffect(() => { if (done) setCanInput(true) }, [done])` stays — it serves the JSON path; the stream path sets `canInput` explicitly.

- [ ] **Step 6: Build**

Run: `pnpm build`
Expected: compiles.

- [ ] **Step 7: Manual verification (dev server, browser)**

1. Normal chat turn → text appears **incrementally** (network tab: `/api/chat` response has `content-type: application/x-ndjson`), input re-enables after completion, graph still refreshes (nodes appear within ~7s of a fact-bearing turn — proves `after()`-deferred extraction ran).
2. Reload the page mid-conversation → last assistant line restores (proves streamed replies were persisted).
3. `/hype-reset`-style fresh user or the opener after >2h → opener still arrives as JSON typewriter (opener fetch sends no `stream` flag) — unchanged behavior.
4. Contract check for mobile: `curl` the route without `stream` (or temporarily remove `stream: true` in devtools) → response is plain JSON `{reply}`.

- [ ] **Step 8: Commit**

```bash
git add app/api/chat/route.ts components/chat/ChatPanel.tsx
git commit -m "feat(chat): real streaming replies (opt-in ndjson), JSON contract preserved

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: You-node bloom animation

**Files:**
- Modify: `apps/web/components/graph/GraphCanvas.tsx` (inside `render()`)

**Interfaces:**
- Consumes: existing `isFirstDraw`, `isNew`, `degreeMap`, `nodeRadius`, `nodeColorFor`, `palette` — all in scope in `render()`.
- Produces: visual only.

- [ ] **Step 1: Mark the solo first draw.** After the line `const isNew = (id: string) => !isFirstDraw && !seen.has(id)`, add:

```ts
    // Fresh-vault moment: the very first draw with only the You node (onboarding) gets a
    // real birth — elastic pop, two ripple rings, and a breathing glow while it's alone.
    const bloomSolo = isFirstDraw && nodes.length === 1
```

- [ ] **Step 2: Let the solo node use the existing pop.** In the enter join, change the core's initial radius and both pop filters:

```ts
          const core = sel.append("circle")
            .attr("class", "core")
            .attr("r", (d) => (isNew(d.id) || bloomSolo ? 0 : nodeRadius(degreeMap[d.id] ?? 0)))
```

```ts
          core.filter((d) => isNew(d.id) || bloomSolo)
            .transition().duration(750).ease(d3.easeElasticOut.amplitude(1).period(0.5))
            .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
          glow.filter((d) => isNew(d.id) || bloomSolo)
            .attr("opacity", 0.5)
            .transition().duration(900).ease(d3.easeCubicOut)
            .attr("opacity", 0.1)
```

- [ ] **Step 3: Ripple rings.** Immediately after the pop transitions above (still inside the enter join, before `sel.append("text")`), add:

```ts
          // Birth ripples — two one-shot expanding rings, then gone.
          if (bloomSolo) {
            for (const delay of [150, 550]) {
              sel.append("circle")
                .attr("fill", "none")
                .attr("stroke", (d) => nodeColorFor(d.topic, palette))
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.55)
                .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0))
                .transition().delay(delay).duration(1400).ease(d3.easeCubicOut)
                .attr("r", (d) => nodeRadius(degreeMap[d.id] ?? 0) * 6)
                .attr("opacity", 0)
                .remove()
            }
          }
```

- [ ] **Step 4: Breathing glow while alone.** After the node join completes (right before `seenNodeIdsRef.current = new Set(...)`), add:

```ts
    // A lone node breathes so a fresh graph feels alive; company arrives → back to static.
    const glows = nodesGroup.selectAll<SVGCircleElement, GraphNode>("circle.glow")
    if (nodes.length === 1) {
      const breathe = (s: d3.Selection<SVGCircleElement, GraphNode, d3.BaseType, unknown>) => {
        s.transition("breathe").duration(1600).ease(d3.easeSinInOut).attr("opacity", 0.32)
          .transition().duration(1600).ease(d3.easeSinInOut).attr("opacity", 0.1)
          .on("end", function () { breathe(d3.select(this as SVGCircleElement) as d3.Selection<SVGCircleElement, GraphNode, d3.BaseType, unknown>) })
      }
      breathe(glows)
    } else {
      glows.interrupt("breathe").attr("opacity", 0.1)
    }
```

Note: the named transition (`"breathe"`) means `interrupt("breathe")` cancels only the loop — the unnamed one-shot glow pulse for newborn nodes is untouched. The static `.attr("opacity", 0.1)` under a running unnamed transition is harmlessly overridden by it.

- [ ] **Step 5: Build + manual check**

Run: `pnpm build` → compiles.
Manual: log in as a user whose vault has only the You node (or temporarily filter `initialData.nodes` to the profile node in dev tools — easier: use the reset skill on a scratch account). Expected: on load, You pops in elastically, two rings ripple out, glow breathes; after the first extraction adds a node, breathing stops.

- [ ] **Step 6: Commit**

```bash
git add components/graph/GraphCanvas.tsx
git commit -m "feat(graph): You-node bloom — birth pop, ripple rings, breathing glow while solo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Share-my-graph image export

**Files:**
- Create: `apps/web/lib/graph/shareImage.ts`
- Modify: `apps/web/components/graph/GraphCanvas.tsx` (share button + handler)

**Interfaces:**
- Produces: `shareGraphImage(svgEl: SVGSVGElement, background: string): Promise<void>` — renders current view to PNG (2×), native share sheet if available, else download.
- Consumes: `svgRef` and `settings.background` already inside GraphCanvas.

- [ ] **Step 1: Create `apps/web/lib/graph/shareImage.ts`**

```ts
// Renders the current graph SVG to a stylized PNG (2×, background + wordmark) and
// opens the native share sheet when available, else downloads. The graph is the
// product's most personal, most shareable object — this is the zero-budget viral loop
// (traction review 2026-07-11, finding #4).

export async function shareGraphImage(svgEl: SVGSVGElement, background: string): Promise<void> {
  const width = svgEl.clientWidth
  const height = svgEl.clientHeight

  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute("width", String(width))
  clone.setAttribute("height", String(height))
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  // SVG text inherits the page font, which serialization loses — pin a fallback.
  clone.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", "system-ui, sans-serif"))

  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("svg rasterize failed"))
      img.src = svgUrl
    })

    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("no 2d context")
    ctx.scale(scale, scale)
    ctx.fillStyle = background || "#0a0a0f"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    // Wordmark — bottom-right, subtle.
    ctx.textAlign = "right"
    ctx.font = "600 18px system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.85)"
    ctx.fillText("hype", width - 20, height - 34)
    ctx.font = "400 11px system-ui, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.45)"
    ctx.fillText("my world, mapped by AI", width - 20, height - 18)

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"))
    if (!blob) throw new Error("toBlob failed")
    const file = new File([blob], "my-hype-graph.png", { type: "image/png" })

    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      // User cancelling the sheet rejects — that's a non-error.
      await navigator.share({ files: [file], title: "My knowledge graph" }).catch(() => {})
    } else {
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = "my-hype-graph.png"
      a.click()
      URL.revokeObjectURL(a.href)
    }
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}
```

- [ ] **Step 2: Add the button to GraphCanvas.** Import at top:

```ts
import { shareGraphImage } from "@/lib/graph/shareImage"
```

Add state + handler inside the component (next to the existing `useState`):

```ts
  const [sharing, setSharing] = useState(false)
  const handleShare = useCallback(async () => {
    if (!svgRef.current || sharing) return
    setSharing(true)
    try {
      await shareGraphImage(svgRef.current, settings.background)
    } catch (err) {
      console.error("[graph] share failed:", err)
    } finally {
      setSharing(false)
    }
  }, [sharing, settings.background])
```

Add the button to the returned JSX, after the tooltip div (z-40 floats it above the chat overlay's z-30; hidden while the vault is empty — an empty graph isn't worth sharing):

```tsx
      {graphData.nodes.length > 1 && (
        <button
          onClick={handleShare}
          aria-label="Share my graph"
          title="Share my graph"
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-10 h-10 rounded-full border border-white/15 bg-black/40 text-white/50 hover:text-white/90 hover:border-white/35 transition-colors"
          style={{ opacity: sharing ? 0.4 : 1 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" />
          </svg>
        </button>
      )}
```

- [ ] **Step 3: Build + manual check**

Run: `pnpm build` → compiles.
Manual (desktop Chrome): open the graph, click the bottom-right share button → a PNG downloads; open it → current graph view on the correct background, node labels legible, "hype" wordmark bottom-right. Zoom the graph, share again → exported image matches the zoomed view.

- [ ] **Step 4: Commit**

```bash
git add lib/graph/shareImage.ts components/graph/GraphCanvas.tsx
git commit -m "feat(graph): share-my-graph PNG export — native share sheet or download

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Out of scope (explicitly deferred)

- Push notifications / email digests (owner: before shipping, not now)
- Onboarding compression (owner: keep the 5-step flow)
- Voice input, analytics, deploy, affiliate wiring (owner: later)
- Anonymize-labels option on the share image (add if beta users ask)
- Extraction retry on failure (cheap; bundle into a future route.ts touch)

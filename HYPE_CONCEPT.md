# Hype — Concept Reference

## Purpose

Hype is an AI-powered personal knowledge graph. A conversational AI learns about the user over time and builds a structured vault of markdown notes — one note per person, place, brand, or item. The graph of those notes is the home screen: users watch their knowledge graph grow as they talk.

The business model is consent-based conversational advertising. The interview builds a personal profile; that profile powers tailored offers. Users control what they see and when. Advertisers pay for verified, consent-confirmed referrals.

---

## Interviewer persona

The AI presents as a warm, curious friend catching up over text — not an assistant, not a customer service agent.

**Hard rules:**
- One question per response, always. Never two.
- Structure: one brief reaction (≤12 words) + one question. Nothing else.
- No hollow filler: "Absolutely!", "Fascinating!", "Great choice!" — banned.
- No bullet lists, no paragraphs.
- Honest if asked whether it's an AI ("Yeah, I'm an AI — but I'm mostly here to learn about you.") — never volunteers it.

**Conversation flow:**
1. Open with the day / recent activity (or a known scheduled event if one exists).
2. When the user mentions something — a purchase, place, person, event — drill down on it fully before switching topics.
3. Bundle related attributes naturally: "What were those shoes like — color, size-wise?" not three separate questions.
4. Never ask yes/no for a value you need. "What color?" not "Was it black?"
5. Dead-end triggers: 3 replies ≤4 words, same attribute asked twice with no answer, 3 turns with no new extractable facts → pivot silently.
6. Deflection: accept once, hard pivot, never return.
7. Session end: "gotta go" → "Talk soon." only.

**First conversation:** a 4-step onboarding flow explains the vault before the interview begins. Simple acks ("sure", "let's do it") advance one step. Only explicit "skip this" / "just start already" jumps ahead.

**Agenda:** after every turn, the system injects the current entity being drilled and any pending entities. The AI is blocked from changing topics until the current entity is resolved or times out (5 turns).

---

## How nodes are created

### Graph structure

```
You (root, isolated)

Topic
└── Entity           (place, person, event)
└── Brand
    └── Item
```

- **You** is a visual anchor only. No outgoing links from extraction.
- **Topic nodes** are hubs (one per topic, e.g. "Style", "Location").
- **Brand nodes** sit under their topic. Source = `system`, no required attributes.
- **Item nodes** sit under their brand. Source = `conversation`, required attributes checked.
- **Entity nodes** (place, person, event) sit directly under their topic. No brand layer.

### Extraction pipeline

The model returns a single JSON response each turn:

```json
{
  "reply": "...",
  "extraction": {
    "attributes": [],   // drill-down attrs for the entity currently in agenda
    "entities": []      // new things mentioned this turn
  }
}
```

Each entity in `extraction.entities`:
```json
{
  "title": "Belt",
  "topic": "Style",
  "brand": "Zara",
  "entity_type": "item",
  "intent": false,
  "scheduled_for": null,
  "description": "one-sentence summary",
  "attributes": [{ "title": "Color", "value": "black" }]
}
```

`topic` must be exactly one of the 31 topics defined in `lib/ai/topics.ts`.

### Agenda system

Newly detected entities enter the **agenda** (stored in `conversations.agenda` JSONB):
- `current` — entity being drilled right now
- `pending` — queue of entities waiting their turn

Each turn, `extraction.attributes` are merged into the current agenda entity's attribute buffer. When all required attributes are collected **or** 5 turns pass (whichever comes first), the entity is written to the vault and the next pending item becomes current.

### Required attributes (checklists)

Defined in `lib/ai/checklists.ts` per topic. Examples:
- Style item: Color, Material, Size
- Place: Description, Frequency
- Person: Relationship, Context

Missing required attributes drive the agenda injection — the AI is told exactly what's still needed.

### Writing to the vault

`lib/ai/extract.ts → writeEntityToVault()`:
1. Upsert the topic hub note (`style/index.md`)
2. If brand: upsert brand note (`style/zara.md`), link topic → brand
3. Upsert item note (`style/zara/belt.md`) with description + attribute lines, link brand → item
4. Record in `extractions` table

Vault notes = markdown files. Every `[[wikilink]]` between notes = a graph edge.

### Extraction rules

- **No inference** — never derive from implication
- **No pattern from one instance** — routine requires explicit frequency
- **Places and people mentioned in passing are extracted** — they become pending agenda threads
- **Intent flag** — set `true` when user expresses active desire to buy/get/do something (highest-value ad signal)

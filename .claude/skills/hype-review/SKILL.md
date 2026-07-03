---
name: hype-review
description: Review the latest interview conversation — pull the most recent conversation's messages and critique the AI interviewer against the interviewer rules in CLAUDE.md.
---

# Hype Review

Pulls the user's most recent conversation and reviews how the AI interviewer performed.

User id: `09158791-8006-453c-b176-98253e3ff1d8`

## 1. Fetch the latest conversation's messages

Run via the Supabase MCP tool (`mcp__supabase__execute_sql`):

```sql
SELECT m.role, m.content, m.created_at
FROM messages m
WHERE m.conversation_id = (
  SELECT id FROM conversations
  WHERE user_id = '09158791-8006-453c-b176-98253e3ff1d8'
  ORDER BY created_at DESC
  LIMIT 1
)
ORDER BY m.created_at ASC;
```

## 2. Review the transcript

Read the full back-and-forth in order, then critique the **assistant** turns against the interviewer rules in `CLAUDE.md` ("Key interviewer rules"). Flag concrete violations with the offending message quoted. Check especially:

- **Value rule** — never asked yes/no about an attribute; always pushed for the specific value
- **Natural grouping** — bundled color/material/size instead of one attribute per turn
- **Deflection** — accepted a deflection and hard-pivoted, never circled back to it
- **Agenda anchoring** — followed pivots 2–3 turns then re-anchored ("back to that…")
- **Dead-end / wrap** — offered to wrap only on the real triggers, not early
- **Persona** — no yes/no attribute questions, no off-topic answers, no volunteered AI identity, warm sign-off

## 3. Output

A short report:
1. **What worked** — 2–4 bullets
2. **Rule violations** — each with the quoted turn and which rule it broke
3. **Extraction check (optional)** — if facts were clearly stated but seem missed, note them; suggest running `/vault-inspect` to confirm what landed

Keep it to what's actionable. No transcript dump.

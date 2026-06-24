---
name: extraction-run
description: Run the extraction pipeline against a conversation — pulls facts from messages, writes vault notes, and updates the graph.
---

# Extraction Run

Given a conversation ID (or the most recent conversation if none provided), run the extraction pipeline:

1. Fetch all messages from the `messages` table for the conversation
2. Call Claude Haiku with an extraction prompt to identify facts, topics, and relationships
3. Write new or updated `vault_notes` rows for each extracted topic
4. Write `vault_links` rows for each relationship between notes
5. Report a summary: how many notes created/updated, how many links created

## Usage

```
/extraction-run [conversation_id]
```

If no conversation_id is given, use the most recent conversation for the authenticated user.

## Implementation notes

- Extraction lives in `lib/ai/extract.ts` (create if not yet built)
- Vault writes live in `lib/vault/write.ts` (create if not yet built)  
- The API route will be `app/api/vault/route.ts`
- Use the admin Supabase client for writes (bypasses RLS), but scope all queries by `user_id`

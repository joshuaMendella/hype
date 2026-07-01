---
name: hypereset
description: Wipe all vault nodes, reset the agenda, and set onboarded=false so the onboarding flow runs again on next chat.
---

# Reset All

Wipes the user's vault and resets all session state so the onboarding flow triggers fresh on the next chat.

Run these SQL statements via the Supabase MCP tool (`mcp__supabase__execute_sql`), in order. Deleting the conversations (rather than just blanking the agenda) means the next chat spawns a fresh conversation with an empty agenda and no stale message history — a true clean slate.

1. **Wipe vault** — calls the existing idempotent reset function, re-seeds the root "You" node:
```sql
SELECT reset_vault('09158791-8006-453c-b176-98253e3ff1d8');
```

2. **Clear advertiser intents** — Phase 4 intent rows (open/offered/converted) tied to this user:
```sql
DELETE FROM intents WHERE user_id = '09158791-8006-453c-b176-98253e3ff1d8';
```

3. **Delete message history** — all messages on this user's conversations:
```sql
DELETE FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = '09158791-8006-453c-b176-98253e3ff1d8'
);
```

4. **Delete conversations** — drops agenda (current + pending) and session state; next chat creates a fresh one:
```sql
DELETE FROM conversations WHERE user_id = '09158791-8006-453c-b176-98253e3ff1d8';
```

5. **Reset onboarding flag** — next chat will trigger the 4-step onboarding flow:
```sql
UPDATE profiles
SET onboarded = false
WHERE id = '09158791-8006-453c-b176-98253e3ff1d8';
```

After all succeed, confirm: "Reset complete — vault wiped, intents cleared, messages + conversations deleted, onboarding reset. Reload the chat to start fresh."

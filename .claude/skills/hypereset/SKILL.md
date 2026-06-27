---
name: hypereset
description: Wipe all vault nodes, reset the agenda, and set onboarded=false so the onboarding flow runs again on next chat.
---

# Reset All

Wipes the user's vault and resets all session state so the onboarding flow triggers fresh on the next chat.

Run these three SQL statements via the Supabase MCP tool (`mcp__supabase__execute_sql`), in order:

1. **Wipe vault** — calls the existing idempotent reset function, re-seeds the root "You" node:
```sql
SELECT reset_vault('09158791-8006-453c-b176-98253e3ff1d8');
```

2. **Reset agenda** — clears current entity and pending queue:
```sql
UPDATE conversations
SET agenda = '{"current": null, "pending": []}'::jsonb
WHERE user_id = '09158791-8006-453c-b176-98253e3ff1d8';
```

3. **Reset onboarding flag** — next chat will trigger the 4-step onboarding flow:
```sql
UPDATE profiles
SET onboarded = false
WHERE id = '09158791-8006-453c-b176-98253e3ff1d8';
```

After all three succeed, confirm: "Reset complete — vault wiped, agenda cleared, onboarding reset. Reload the chat to start fresh."

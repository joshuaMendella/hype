---
name: vault-inspect
description: Dump a user's vault notes and links to verify the graph is being built correctly. Pass a user_id or use the current session user.
---

# Vault Inspect

Query and display the current vault state for a user.

## Usage

```
/vault-inspect [user_id]
```

## What to show

1. Count of vault notes, grouped by topic/type
2. List of all notes: id, title, type, updated_at
3. List of all links: source_note_id → target_note_id, link_type
4. Any orphaned notes (notes with no links)
5. Any broken links (links referencing non-existent notes)

## Implementation

Query the Supabase tables directly:
- `vault_notes` — filter by `user_id`
- `vault_links` — join on `vault_notes` to get titles

Use the admin client (`lib/supabase/admin.ts`) if running from an API route, or the server client if running in an RSC.

Output a plain text or JSON report to the console.

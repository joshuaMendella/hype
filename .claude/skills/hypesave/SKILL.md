---
name: hypesave
description: Commit and push all session changes to GitHub, then update CLAUDE.md with the current session state.
---

# Hype Save

End-of-session save: commits all relevant changes and pushes to GitHub.

## Steps

### 1. Check what changed
Run these in parallel:
```
git status
git diff HEAD
```

### 2. Update CLAUDE.md
Based on what was built or fixed this session, update the relevant sections of CLAUDE.md:
- Add completed items to "What's been built" (with today's date updated in the header line)
- Remove items from "What's NOT done yet" if they're now done
- Update the date in the header `## What's been built (as of YYYY-MM-DD, updated session N)` — increment the session number

### 3. Stage files
Stage all modified tracked files. Never stage:
- `.env.local`
- `.mcp.json`
- `nul`
- Any file matching `*.key`, `*.pem`, `*secret*`

```
git add -u
git add .claude/skills/
```

Also stage any new untracked files that belong in the repo (new source files, skill files, config). Skip anything that looks like a secret or temp file.

### 4. Commit
Write a commit message that summarises what changed this session. Follow the existing commit style (imperative, present tense, `feat:` / `fix:` / `docs:` prefix). If multiple concerns changed, use a multi-line message.

Use the heredoc form:
```
git commit -m "$(cat <<'EOF'
feat/fix: short summary

- bullet 1
- bullet 2

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

### 5. Push
```
git push origin main
```

### 6. Confirm
Print a one-line summary: what was committed and that the push succeeded.

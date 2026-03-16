# Error Self-Learning Protocol

After fixing any bug, run:
```bash
node scripts/log-error.mjs --error "..." --file "src/..." --fix "..." --category "database|ollama|memory|dashboard|general" --lesson "Concise rule"
```

This appends to `scripts/error-log.jsonl` AND updates `.claude/rules/lessons-learned.md`.
Claude Code reads lessons on next session start.

Run `node scripts/update-lessons.mjs` to detect recurring patterns (3+ similar errors).

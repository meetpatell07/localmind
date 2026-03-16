# LocalMind — CLAUDE.md

## What This Is
Personal AI agent. Runs 24/7. Learns about its owner. Local LLM, cloud DB, tabbed dashboard.
Sprint 1: ship a working prototype in 24 hours.

## Stack
- **Next.js 14** App Router, TypeScript strict, Tailwind + shadcn/ui
- **Neon Postgres** (pgvector) — single DB for everything, migrate sensitive data local later
- **Drizzle ORM** + drizzle-kit — schema in `src/db/schema.ts`
- **Ollama** localhost:11434 — Qwen 2.5 7B chat, nomic-embed-text embeddings
- **Whisper.cpp** STT + **Piper** TTS — local voice, CPU-only
- **MCP** for tool connectors (Gmail, Calendar, files)

## Commands
- `pnpm install` → `pnpm dev` → open localhost:3000
- `pnpm db:generate` → `pnpm db:migrate` (push schema to Neon)
- `pnpm db:studio` (visual DB browser)
- `pnpm test` (Vitest) → `pnpm lint:fix`

## Sprint Plan (24 Hours)
@docs/sprint-plan.md

## Schema
@src/db/schema.ts

## Architecture
@docs/architecture.md

## Project Structure
```
src/
├── db/schema.ts              # Drizzle schema (ALL tables)
├── db/index.ts               # Neon connection + Drizzle client
├── agent/
│   ├── ollama.ts             # Chat + embeddings client
│   ├── prompt-builder.ts     # system + profile + memory + user → prompt
│   └── extract.ts            # Entity/relationship extraction
├── memory/
│   ├── episodic.ts           # L1: log conversations
│   ├── semantic.ts           # L2: embed + similarity search
│   ├── entity.ts             # L3: entities + relationships CRUD
│   ├── profile.ts            # L4: user profile rebuild
│   └── index.ts              # Unified memory API
├── app/                      # Next.js pages
│   ├── page.tsx              # Dashboard home
│   ├── chat/page.tsx         # Chat tab
│   ├── memory/page.tsx       # Memory viewer
│   ├── planner/page.tsx      # Tasks/plans
│   ├── api/chat/route.ts     # Chat API (streaming)
│   ├── api/memory/route.ts   # Memory CRUD
│   └── api/tasks/route.ts    # Planner CRUD
├── components/               # Shared UI
├── lib/                      # Client utils
└── shared/                   # Types, Zod schemas, constants
```

## Code Rules
- TypeScript strict, no `any`, no untyped `as` casts
- Named exports only
- Zod for all external data (Ollama responses, MCP results, API inputs)
- All dates: ISO 8601 with timezone → `timestamp with time zone` in Postgres
- Drizzle queries only — raw SQL only for pgvector similarity ops
- `@/` path alias for `src/`

## Critical Rules
- NEVER hardcode DATABASE_URL — .env.local only
- ALWAYS null-check Ollama responses (undefined on timeout)
- ALWAYS use parameterized Drizzle queries — never string interpolation
- ALWAYS handle Ollama offline: show "AI starting up..." + retry every 3s
- ALWAYS stream chat responses (`stream: true`)
- Memory pipeline is POST-RESPONSE and ASYNC — never block the user

## Error Self-Learning
After fixing any bug:
1. Log: `node scripts/log-error.mjs --error "..." --fix "..." --category "..." --lesson "..."`
2. Lessons auto-append to `.claude/rules/lessons-learned.md`
3. Claude Code reads updated lessons on next session
@scripts/error-learning-protocol.md

## Migration Notes (Week 2)
Tables that move to local SQLite later (privacy):
- `conversations` (raw message content)
- `embeddings` (can reverse-engineer to original text)
- `entities` + `relationships` (personal knowledge graph)
- `profile` (user summary)
Tables that stay in Neon (low sensitivity, benefit from cloud):
- `sessions`, `tasks`, `vault_files`, `mcp_tool_log`, `settings`
Drizzle supports both drivers — schema stays ~identical, just swap the connection.

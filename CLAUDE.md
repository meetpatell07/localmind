# LocalMind — CLAUDE.md

## What This Is
Personal AI agent. Single user (Meet), no auth needed. Runs 24/7, learns about its owner over time. Local LLM inference, cloud-persistent memory, tabbed dashboard.

## Stack
- **Framework**: Next.js 14+ App Router, TypeScript strict
- **AI**: Vercel AI SDK (`ai` package) + Ollama provider (`ollama-ai-provider`)
- **LLM**: Ollama localhost:11434 — Qwen 2.5 7B (chat), nomic-embed-text (embeddings)
- **Database**: Neon Postgres with pgvector — single DB for everything
- **ORM**: Drizzle ORM + drizzle-kit
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (global) + React hooks (local)
- **Voice**: Browser Web Speech API for sprint 1 (Whisper.cpp + Piper week 2)
- **Validation**: Zod everywhere

## What We Are NOT Building in Sprint 1
- No auth (single user, localhost only)
- No MCP tool connections (Gmail, Calendar, etc. — week 2)
- No Arduino/ambient sensing
- No messaging integrations (WhatsApp, Telegram — week 2)
- No Docker

## Commands
- `pnpm install`
- `pnpm dev` — starts Next.js on localhost:3000
- `pnpm build` — production build
- `pnpm test` — Vitest
- `pnpm lint:fix` — ESLint + Prettier
- `pnpm db:generate` — drizzle-kit generate
- `pnpm db:migrate` — drizzle-kit migrate (push to Neon)
- `pnpm db:studio` — Drizzle Studio (visual DB browser)

## Project Structure
```
localmind/
├── CLAUDE.md                     # This file — Claude Code reads first
├── .claude/rules/                # Modular rules (auto-loaded)
├── .env.local                    # Secrets (gitignored)
├── .env.example                  # Template for .env.local
├── docs/                         # Architecture docs (@imported)
├── scripts/                      # Error learning system
├── src/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (ALL tables)
│   │   ├── index.ts              # Neon + Drizzle client
│   │   └── migrations/           # drizzle-kit output
│   ├── agent/
│   │   ├── ollama.ts             # Ollama client via AI SDK
│   │   ├── prompt-builder.ts     # system + profile + memory + user → prompt
│   │   └── extract.ts            # Entity/relationship extraction
│   ├── memory/
│   │   ├── episodic.ts           # L1: conversation logs
│   │   ├── semantic.ts           # L2: pgvector similarity search
│   │   ├── entity.ts             # L3: entities + relationships
│   │   ├── profile.ts            # L4: user profile summary
│   │   └── index.ts              # Unified memory API
│   ├── planner/
│   │   ├── tasks.ts              # Task CRUD
│   │   └── ai-planner.ts         # AI daily plans
│   ├── vault/
│   │   ├── indexer.ts            # File metadata → Postgres
│   │   └── organizer.ts          # YYYY/MM/DD structure
│   ├── frontend/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── layout.tsx        # Root layout + tab navigation
│   │   │   ├── page.tsx          # Dashboard home / redirect to chat
│   │   │   ├── chat/
│   │   │   │   └── page.tsx      # Chat tab
│   │   │   ├── memory/
│   │   │   │   └── page.tsx      # Memory viewer tab
│   │   │   ├── planner/
│   │   │   │   └── page.tsx      # Tasks/Kanban tab
│   │   │   ├── files/
│   │   │   │   └── page.tsx      # File vault tab
│   │   │   ├── voice/
│   │   │   │   └── page.tsx      # Voice tab
│   │   │   └── api/
│   │   │       ├── chat/
│   │   │       │   └── route.ts  # Streaming chat endpoint (AI SDK)
│   │   │       ├── memory/
│   │   │       │   └── route.ts  # Memory search + profile
│   │   │       ├── tasks/
│   │   │       │   └── route.ts  # Task CRUD
│   │   │       └── files/
│   │   │           └── route.ts  # File upload + list
│   │   ├── components/           # Shared React components
│   │   │   ├── chat/
│   │   │   │   ├── message-list.tsx
│   │   │   │   ├── message-bubble.tsx
│   │   │   │   └── chat-input.tsx
│   │   │   ├── planner/
│   │   │   │   ├── task-card.tsx
│   │   │   │   └── kanban-board.tsx
│   │   │   ├── memory/
│   │   │   │   ├── profile-card.tsx
│   │   │   │   └── entity-list.tsx
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── tab-nav.tsx
│   │   │   └── ui/               # shadcn/ui components
│   │   └── lib/
│   │       ├── stores/           # Zustand stores
│   │       └── utils.ts          # Client helpers (cn, formatDate, etc.)
│   └── shared/
│       ├── types.ts              # Shared TypeScript types
│       ├── constants.ts          # App constants
│       └── schemas.ts            # Shared Zod schemas
├── vault/                        # Local file storage (gitignored)
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Code Rules
- TypeScript strict — no `any`, no untyped `as` casts
- Named exports only, never default exports
- Functional React components with hooks only
- Zod for ALL external data validation
- All dates: ISO 8601 → `timestamp with time zone` in Postgres
- `@/` path alias for `src/`
- Drizzle queries only — raw SQL only for pgvector similarity ops

## Critical Rules
- NEVER hardcode DATABASE_URL — .env.local only
- ALWAYS null-check Ollama responses — undefined on timeout
- ALWAYS use parameterized Drizzle queries — never string interpolation
- ALWAYS handle Ollama offline: show "AI starting up..." + auto-retry
- ALWAYS stream chat responses via Vercel AI SDK `streamText()`
- Memory pipeline is POST-RESPONSE, ASYNC — never block the user

## AI SDK Usage Pattern
```typescript
import { streamText } from "ai";
import { ollama } from "ollama-ai-provider";

const result = streamText({
  model: ollama("qwen2.5:7b"),
  system: profilePrompt + memoryContext,
  messages: conversationHistory,
});
return result.toDataStreamResponse();
```
Client side: use `useChat()` hook from `ai/react` for streaming UI.

## Memory Architecture
@docs/memory-architecture.md

## Schema
@src/db/schema.ts

## Sprint Plan
@docs/sprint-plan.md

## Error Self-Learning
After fixing any bug:
1. Log it: `node scripts/log-error.mjs --error "..." --fix "..." --category "..." --lesson "..."`
2. Auto-updates `.claude/rules/lessons-learned.md`
3. Claude Code reads updated lessons next session

# Sprint Plan — 24 Hours to Working Prototype

## Hour 0-2: Foundation
- [ ] `pnpm create next-app@latest localmind --ts --tailwind --app --src-dir`
- [ ] Install deps: `pnpm add drizzle-orm @neondatabase/serverless zod zustand`
- [ ] Install dev deps: `pnpm add -D drizzle-kit @types/node`
- [ ] Set up .env.local with DATABASE_URL (create Neon project, enable pgvector)
- [ ] Create `src/db/schema.ts` (copy from this project's schema)
- [ ] Create `src/db/index.ts` (Neon + Drizzle client)
- [ ] Create `drizzle.config.ts`
- [ ] Run `pnpm db:generate` + `pnpm db:migrate`
- [ ] Add pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Add vector column + HNSW index via raw SQL migration
- [ ] Install shadcn/ui: `pnpx shadcn-ui@latest init` + add button, input, card, tabs, dialog
- [ ] Verify: `pnpm dev` → localhost:3000 shows Next.js page

## Hour 2-6: Chat + Ollama Integration (CORE)
- [ ] Create `src/agent/ollama.ts` — chat client with streaming + embeddings
- [ ] Create `src/agent/prompt-builder.ts` — assembles system + profile + context + user
- [ ] Create `src/app/api/chat/route.ts` — POST streaming endpoint
- [ ] Create `src/app/chat/page.tsx` — chat UI with message list + input
- [ ] Create `src/components/message-bubble.tsx` — renders markdown, streams tokens
- [ ] Wire up: type message → hits API → streams Ollama response → renders in UI
- [ ] Handle Ollama offline state (retry banner)
- [ ] TEST: Have a conversation with your local LLM through the dashboard

## Hour 6-10: Memory System (DIFFERENTIATOR)
- [ ] Create `src/memory/episodic.ts` — insert/query conversations table
- [ ] Create `src/memory/semantic.ts` — embed chunks + similarity search via pgvector
- [ ] Create `src/memory/entity.ts` — extract entities/relationships from conversations
- [ ] Create `src/agent/extract.ts` — Ollama prompt that outputs JSON entities + Zod validation
- [ ] Create `src/memory/profile.ts` — aggregate entities → user profile summary text
- [ ] Create `src/memory/index.ts` — unified API: remember(), recall(), getProfile()
- [ ] Wire into chat: post-response async pipeline (L1→L2→L3→L4)
- [ ] Update prompt-builder to inject profile + relevant memories
- [ ] TEST: Tell the agent your name, favorite food, job → verify it remembers next session

## Hour 10-13: Dashboard Tabs
- [ ] Create layout with tab navigation (shadcn Tabs or sidebar)
- [ ] Chat tab: already done
- [ ] Memory tab (`src/app/memory/page.tsx`): show profile, entity list, recent memories, search
- [ ] Planner tab (`src/app/planner/page.tsx`): task list with add/edit/complete, basic Kanban
- [ ] Create `src/app/api/tasks/route.ts` — CRUD for tasks table
- [ ] Create `src/app/api/memory/route.ts` — search memories, view profile, view entities
- [ ] TEST: Create tasks, view your memory profile, switch between tabs

## Hour 13-16: File Vault + MCP Basics
- [ ] Create `src/app/files/page.tsx` — file browser showing vault_files from DB
- [ ] Create file upload API: accept file → save to local vault dir → index metadata in DB
- [ ] Create `src/app/api/files/route.ts` — upload, list, search
- [ ] Basic MCP client (`src/mcp/client.ts`) — connect to filesystem MCP server
- [ ] Connections tab (`src/app/connections/page.tsx`) — list of MCP servers with on/off toggles
- [ ] TEST: Upload a PDF, see it in files tab, ask the AI about it

## Hour 16-19: Voice + Polish
- [ ] Voice tab (`src/app/voice/page.tsx`) — push-to-talk button + transcript display
- [ ] Integrate Whisper.cpp for STT (or browser Web Speech API as fast fallback)
- [ ] Integrate Piper TTS for responses (or browser speechSynthesis as fast fallback)
- [ ] Wire voice → chat API → voice response loop
- [ ] Polish: loading skeletons, error states, dark mode, responsive layout
- [ ] TEST: Talk to your AI, hear it respond

## Hour 19-22: AI Planner + Proactive Features
- [ ] AI daily planner: generate today's plan from tasks + profile
- [ ] Natural language task creation: "remind me to..." → creates task with parsed due date
- [ ] Add `/api/planner/daily` route — AI-generated daily briefing
- [ ] Session summaries: on tab close, summarize the conversation
- [ ] TEST: Ask AI to plan your day, create tasks via natural language

## Hour 22-24: Integration Test + Deploy
- [ ] End-to-end test: chat → memory persists → entities extracted → profile built → planner works
- [ ] Write 5-10 critical Vitest tests (Ollama mock, memory pipeline, task CRUD)
- [ ] Fix any broken edges
- [ ] Document: update README with setup instructions
- [ ] Optional: Docker Compose for Ollama + app
- [ ] SHIP IT

## What to Skip in Sprint 1
- Arduino / ambient sensing
- WhatsApp / Telegram integration (use dashboard chat only)
- Gmail / Calendar MCP (just filesystem MCP)
- Migration to local SQLite (week 2)
- Comprehensive test coverage (ship first, test later)
- Auth (single user, localhost only)

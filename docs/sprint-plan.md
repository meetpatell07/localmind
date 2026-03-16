# Sprint Plan — 24 Hours

## Hour 0-2: Foundation
- [ ] `pnpm create next-app@latest localmind --ts --tailwind --app --src-dir`
- [ ] Restructure: move app/ into `src/frontend/app/`, update next.config.ts
- [ ] Install core: `pnpm add drizzle-orm @neondatabase/serverless ai ollama-ai-provider zod zustand`
- [ ] Install dev: `pnpm add -D drizzle-kit`
- [ ] Install UI: `pnpx shadcn-ui@latest init` → add button, input, card, tabs, dialog, scroll-area, textarea, badge, separator
- [ ] Copy schema.ts into src/db/schema.ts
- [ ] Create src/db/index.ts (Neon connection + Drizzle client)
- [ ] Create drizzle.config.ts pointing to src/db/schema.ts
- [ ] Set up .env.local with DATABASE_URL
- [ ] Run `pnpm db:generate` + `pnpm db:migrate`
- [ ] In Neon SQL Editor: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Add vector column + HNSW index via raw SQL
- [ ] Verify: `pnpm dev` → localhost:3000

## Hour 2-6: Chat + AI SDK (CORE)
- [ ] Create src/agent/ollama.ts — Ollama via AI SDK provider
- [ ] Create src/agent/prompt-builder.ts — assembles system + profile + memory + user
- [ ] Create src/frontend/app/api/chat/route.ts — streaming via AI SDK `streamText()`
- [ ] Create src/frontend/app/chat/page.tsx — chat page using `useChat()` from ai/react
- [ ] Create src/frontend/components/chat/message-list.tsx
- [ ] Create src/frontend/components/chat/message-bubble.tsx (markdown rendering)
- [ ] Create src/frontend/components/chat/chat-input.tsx
- [ ] Create src/frontend/app/layout.tsx with tab navigation (sidebar or top tabs)
- [ ] Handle Ollama offline state (retry banner)
- [ ] TEST: Have a streaming conversation with local Ollama

## Hour 6-10: Memory System (DIFFERENTIATOR)
- [ ] Create src/memory/episodic.ts — insert + query conversations table
- [ ] Create src/memory/semantic.ts — embed chunks + pgvector similarity search
- [ ] Create src/agent/extract.ts — Ollama structured output → JSON entities + Zod validation
- [ ] Create src/memory/entity.ts — entities + relationships CRUD with dedup
- [ ] Create src/memory/profile.ts — aggregate entities → profile summary
- [ ] Create src/memory/index.ts — unified API: remember(), recall(), getProfile()
- [ ] Wire into chat API: post-response async pipeline (L1→L2→L3→L4)
- [ ] Update prompt-builder to inject profile + relevant memories
- [ ] Create src/frontend/app/api/memory/route.ts — search + profile endpoints
- [ ] TEST: Tell agent your name and job → close session → reopen → verify it remembers

## Hour 10-14: Dashboard Tabs
- [ ] Create src/frontend/components/layout/sidebar.tsx or tab-nav.tsx
- [ ] Chat tab: already done
- [ ] Memory tab (src/frontend/app/memory/page.tsx): profile card, entity list, memory search
- [ ] Create src/frontend/components/memory/profile-card.tsx
- [ ] Create src/frontend/components/memory/entity-list.tsx
- [ ] Planner tab (src/frontend/app/planner/page.tsx): task list + basic Kanban
- [ ] Create src/planner/tasks.ts — CRUD for tasks table
- [ ] Create src/frontend/app/api/tasks/route.ts
- [ ] Create src/frontend/components/planner/task-card.tsx
- [ ] Create src/frontend/components/planner/kanban-board.tsx
- [ ] TEST: Create tasks, view memory profile, switch tabs

## Hour 14-17: Files + Voice
- [ ] Files tab (src/frontend/app/files/page.tsx) — file browser
- [ ] Create src/frontend/app/api/files/route.ts — upload, list, search
- [ ] Create src/vault/indexer.ts — file metadata → Postgres
- [ ] Create src/vault/organizer.ts — auto-organize into YYYY/MM/DD
- [ ] Voice tab (src/frontend/app/voice/page.tsx) — push-to-talk
- [ ] Use browser Web Speech API (SpeechRecognition + speechSynthesis)
- [ ] Wire voice → chat API → voice response
- [ ] TEST: Upload a file, talk to AI via voice

## Hour 17-20: AI Planner + Polish
- [ ] Create src/planner/ai-planner.ts — generate daily plan from tasks + profile
- [ ] Natural language task creation: "remind me to..." → parse → create task
- [ ] Polish: loading skeletons, error states, dark mode toggle
- [ ] Responsive layout for mobile
- [ ] Session summaries: summarize conversation on tab close

## Hour 20-24: Test + Ship
- [ ] End-to-end test: chat → memory persists → entities extracted → profile built
- [ ] Write 5-10 Vitest tests (Ollama mock, memory pipeline, task CRUD)
- [ ] Fix broken edges
- [ ] Update README with setup instructions
- [ ] SHIP IT

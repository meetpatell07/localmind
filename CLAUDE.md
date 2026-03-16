# LocalMind — CLAUDE.md

## What This Is
Personal AI agent. Single user (Meet), no auth needed. Runs 24/7, learns about its owner over time. Local LLM inference, cloud-persistent memory, tabbed dashboard with external tool connectors.

## Stack
- **Framework**: Next.js 16 App Router, TypeScript strict
- **AI**: Vercel AI SDK v6 (`ai` + `@ai-sdk/react` + `@ai-sdk/openai`) — Ollama via OpenAI-compat `/v1`
- **LLM**: Ollama localhost:11434 — qwen3:8b (chat), nomic-embed-text (embeddings)
- **Database**: Neon Postgres with pgvector — single DB for everything
- **ORM**: Drizzle ORM + drizzle-kit
- **Styling**: Tailwind CSS + shadcn/ui — Precision Dark Amber theme
- **State**: Zustand (global) + React hooks (local)
- **Voice**: Browser Web Speech API
- **Validation**: Zod everywhere
- **Graph viz**: @xyflow/react (React Flow)
- **Connectors**: googleapis + google-auth-library (Gmail + Calendar OAuth)

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
src/
├── app/                         # Next.js App Router pages + API routes
│   ├── layout.tsx               # Root layout — sidebar, TabNav, MobileNav
│   ├── chat/page.tsx            # Chat tab (useChat v6, sessionId ref)
│   ├── memory/page.tsx          # Memory tab (Profile · Entities · Graph · Search · Recent)
│   ├── planner/page.tsx         # Kanban + NL task input + AI daily plan
│   ├── files/page.tsx           # File vault
│   ├── voice/page.tsx           # Push-to-talk (Web Speech API)
│   ├── settings/page.tsx        # Connections (Gmail, Notion, Calendar) + About
│   └── api/
│       ├── chat/route.ts        # Streaming via streamText() + recall/remember
│       ├── memory/route.ts      # Profile, entities, search, recent, decay-stats
│       ├── memory/graph/route.ts # React Flow graph payload (hot-cached)
│       ├── tasks/route.ts       # Task CRUD
│       ├── files/route.ts       # Upload + list
│       ├── health/route.ts      # Ollama health check
│       └── connectors/
│           ├── google/auth/route.ts     # → Google OAuth consent URL
│           ├── google/callback/route.ts # ← stores tokens, redirect /settings
│           └── status/route.ts          # GET all connector statuses, DELETE disconnect
├── agent/
│   ├── ollama.ts                # chatModel + extractionModel via @ai-sdk/openai → Ollama /v1
│   ├── prompt-builder.ts        # Assembles system prompt from MemoryContext
│   └── extract.ts               # generateObject → ExtractionSchema (entities + relationships)
├── memory/
│   ├── episodic.ts              # L1: logMessage, createSession, getRecentHistoryAllSessions
│   ├── semantic.ts              # L2: embedAndStore, searchSimilar (pgvector cosine)
│   ├── entity.ts                # L3: upsertEntity (vector dedup), upsertRelationship (versioned)
│   ├── profile.ts               # L4: buildGraphSnapshot → rebuildProfile (hot-cached)
│   ├── decay.ts                 # Intelligent decay: computeDecayScore, reinforceEntity, runDecayCycle
│   ├── hot.ts                   # In-process TTL cache (hot memory layer, sub-ms)
│   └── index.ts                 # recall() + remember() unified API
├── connectors/
│   └── google-auth.ts           # OAuth2 lifecycle: getAuthUrl, exchangeCode, saveTokens,
│                                #   loadTokens, getAuthenticatedClient, disconnectGoogle
├── planner/
│   ├── tasks.ts                 # Task CRUD
│   └── ai-planner.ts            # generateDailyPlan, parseNaturalLanguageTask
├── vault/
│   ├── indexer.ts               # File metadata → Postgres
│   └── organizer.ts             # YYYY/MM/DD structure
├── frontend/
│   └── components/
│       ├── chat/                # MessageList, MessageBubble, ChatInput (AI SDK v6)
│       ├── memory/              # ProfileCard, EntityList, GraphView (React Flow)
│       ├── planner/             # TaskCard, KanbanBoard
│       ├── layout/              # TabNav, MobileNav, OllamaStatus
│       └── ui/                  # shadcn/ui + Skeleton
└── shared/
    ├── types.ts                 # MemoryContext, RecentTurn, EntityWithRelationships
    ├── constants.ts             # OLLAMA_BASE_URL, EMBEDDING_MODEL, PROFILE_REBUILD_INTERVAL
    └── schemas.ts               # Shared Zod schemas
```

## Database Tables (11 total)
| Table | Layer | Purpose |
|-------|-------|---------|
| `conversations` | L1 Episodic | Append-only message log |
| `sessions` | L1 | Session metadata + summaries |
| `embeddings` | L2 Semantic | pgvector 768-dim chunks |
| `entities` | L3 Graph | Named entities with decay score |
| `relationships` | L3 Graph | Edges with version chain + decay |
| `atomic_facts` | L3b | Granular facts with version chain + decay |
| `profile` | L4 | ~400-token user summary |
| `tasks` | Planner | Kanban tasks |
| `vault_files` | Files | File metadata |
| `settings` | Config | KV store (OAuth tokens under `connector:<provider>:tokens`) |
| `connectors` | Config | Connector status + lastSyncAt |

## Connector Architecture
- **Strategy**: Direct SDK approach — no cloud middleman, tokens stored locally
- **Google OAuth flow**: `/api/connectors/google/auth` → Google consent → `/api/connectors/google/callback` → stored in `settings` table
- **Tokens key**: `connector:google:tokens` in settings table (includes access_token, refresh_token, expiry_date)
- **Connector status**: `connectors` table — isActive, lastSyncAt, syncStatus, connectedAt
- **Future**: Notion via `@notionhq/notion-mcp-server` + `@ai-sdk/mcp` (stdio transport, createMCPClient)
- **Future**: AI SDK tool use — pass tools to streamText() for active tool calling during chat

## Code Rules
- TypeScript strict — no `any`, no untyped `as` casts
- Named exports only, never default exports
- Functional React components with hooks only
- Zod for ALL external data validation
- All dates: ISO 8601 → `timestamp with time zone` in Postgres
- `@/` path alias for `src/`
- Drizzle queries only — raw SQL only for pgvector similarity ops
- NEVER import `ollama-ai-provider` — use `@ai-sdk/openai` pointing to Ollama `/v1`

## Critical Rules
- NEVER hardcode DATABASE_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET — .env.local only
- ALWAYS null-check Ollama responses — undefined on timeout
- ALWAYS use parameterized Drizzle queries — never string interpolation
- ALWAYS handle Ollama offline: show "AI starting up..." + auto-retry
- ALWAYS stream chat responses via Vercel AI SDK `streamText()` → `toUIMessageStreamResponse()`
- Memory pipeline is POST-RESPONSE, ASYNC — never block the user
- OAuth tokens must NEVER be logged or returned in API responses

## AI SDK v6 Pattern (current)
```typescript
// Server: api/chat/route.ts
import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
const result = streamText({
  model: chatModel,  // createOpenAI({ baseURL: OLLAMA_BASE_URL+'/v1', apiKey:'ollama' })("qwen3:8b")
  system: systemPrompt,
  messages: convertToModelMessages(messages as UIMessage[]),
  temperature: 0.7,
  onFinish: async ({ text }) => { await remember(sessionId, userText, text); }
});
return result.toUIMessageStreamResponse();

// Client: app/chat/page.tsx
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
const { messages, sendMessage, status, stop } = useChat({
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ sessionId: sessionIdRef.current }),  // function! not object
  }),
});
```

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

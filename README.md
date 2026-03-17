# LocalMind

Personal AI agent running entirely on your machine. Persistent memory across conversations, knowledge graph extraction, and a full dashboard — no cloud AI, no subscriptions.

---

## What it does

- **Chat** with a local LLM (Qwen via Ollama) that actually remembers you across sessions
- **4-layer memory**: episodic log → semantic embeddings → entity/relationship graph → user profile
- **Intelligent decay**: facts fade over time based on type (events decay in 7 days, people stay sharp for 120 days); re-mentioning anything refreshes it
- **Knowledge graph** visualisation — React Flow canvas showing entities and how they connect, colour-coded by type
- **Planner** — Kanban board + natural-language task creation + AI daily plan
- **File vault** — local file browser with metadata search
- **Voice** — push-to-talk via browser Web Speech API

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | |
| pnpm | 9+ | `npm i -g pnpm` |
| Ollama | latest | [ollama.ai](https://ollama.ai) |
| Neon account | — | Free tier is sufficient |

---

## 1. Clone and install

```bash
git clone https://github.com/your-username/localmind.git
cd localmind
pnpm install
```

---

## 2. Pull Ollama models

```bash
# Chat model (4.9 GB)
ollama pull qwen3:8b

# Embedding model (274 MB)
ollama pull nomic-embed-text
```

Verify Ollama is running: `curl http://localhost:11434/` should return `Ollama is running`.

---

## 3. Set up Neon Postgres

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the connection string from **Project → Connection Details** (choose the **pooled** endpoint)
3. Open the **Neon SQL Editor** and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS embed_hnsw_idx ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);
```

> Run this **after** the first migration in step 5.

---

## 4. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Neon connection string (with ?sslmode=require)
DATABASE_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require

# Ollama — defaults work if running on localhost
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
EMBEDDING_MODEL=nomic-embed-text
```

---

## 5. Run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

Then run the SQL from step 3 in the Neon SQL Editor to add the pgvector column and HNSW index.

---

## 6. Connect Gmail + Google Calendar (optional)

Required only if you want the Email tab (AI-powered inbox, draft replies, calendar checks).

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable **Gmail API** and **Google Calendar API** (APIs & Services → Library)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web Application**
   - Authorized redirect URIs: `http://localhost:3000/api/connectors/google/callback`
5. Copy the **Client ID** and **Client Secret** into `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

6. In the running app, go to **Settings → Connections** and click **Connect Google**

---

## 7. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The amber status dot in the top-right shows Ollama's live status. If it's grey, start Ollama first:

```bash
ollama serve
```

---

## Commands

```bash
pnpm dev          # Start development server (localhost:3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint:fix     # ESLint + Prettier
pnpm test         # Run Vitest tests
pnpm db:generate  # Generate migration from schema changes
pnpm db:migrate   # Apply migrations to Neon
pnpm db:studio    # Open Drizzle Studio (visual DB browser)
```

---

## Architecture

```
User message
    │
    ├─ L4 Profile (hot cache, 5 min TTL)          ← injected into every prompt
    ├─ L2 Semantic search (pgvector, top-5)       ← relevant past context
    ├─ L3 Entity lookup (knowledge graph)         ← known facts about mentioned names
    │
    ▼
Ollama qwen3:8b → streaming response → user
    │
    └─ ASYNC post-response pipeline:
        L1  Log turn to conversations table
        L2  Embed combined text → pgvector
        L3  Extract entities/relationships → graph upsert
            └─ Reinforce decay scores for re-mentioned entities
        L4  Rebuild profile every 50 interactions
        Decay cycle every 25 interactions (pure math, no LLM)
```

### Memory layers

| Layer | Table | What's stored |
|-------|-------|---------------|
| L1 Episodic | `conversations` | Append-only conversation log |
| L2 Semantic | `embeddings` + pgvector | 768-dim embeddings, cosine similarity search |
| L3 Graph | `entities` + `relationships` + `atomic_facts` | Knowledge graph with versioned fact history |
| L4 Profile | `profile` | ~500-token natural-language user summary |

### Intelligent decay

Every entity, relationship, and atomic fact has a `decay_score` (0–1) that decays exponentially based on type:

| Type | Half-life |
|------|-----------|
| event | 7 days |
| preference | 30 days |
| technology | 60 days |
| project / organization | 90 days |
| person | 120 days |
| concept | 180 days |

Re-mentioning an entity in conversation refreshes its score toward 1.0. Entities below 0.05 are excluded from prompt injection (still in the DB for explicit recall).

---

## Stack

- **Next.js 16** App Router, TypeScript strict
- **Vercel AI SDK v6** (`ai` + `@ai-sdk/react` + `@ai-sdk/openai`)
- **Ollama** via OpenAI-compat `/v1` endpoint
- **Neon Postgres** + pgvector — single DB for all memory layers
- **Drizzle ORM** — all queries parameterized
- **React Flow** (`@xyflow/react`) — knowledge graph visualisation
- **Tailwind CSS** + shadcn/ui — Precision Dark Amber theme
- **Zustand** — global state

---

## Project structure

```
src/
├── app/              # Next.js App Router pages + API routes
├── agent/            # Ollama client, prompt builder, entity extractor
├── memory/           # 4-layer memory pipeline
│   ├── episodic.ts   # L1: conversation log
│   ├── semantic.ts   # L2: pgvector similarity search
│   ├── entity.ts     # L3: entity/relationship graph
│   ├── profile.ts    # L4: user profile summary
│   ├── decay.ts      # Intelligent decay engine
│   ├── hot.ts        # In-process TTL cache (hot memory layer)
│   └── index.ts      # Unified recall() + remember() API
├── planner/          # Task CRUD + AI daily plan
├── vault/            # File metadata + organizer
├── frontend/         # React components
└── shared/           # Types, constants, Zod schemas
```

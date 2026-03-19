# LocalMind

Personal AI agent running entirely on your machine. Persistent memory across conversations, knowledge graph extraction, and a full dashboard — no cloud AI, no subscriptions.

---

## What it does

- **Chat** with a local LLM (Qwen via Ollama) that actually remembers you across sessions
- **4-layer memory**: episodic log → semantic embeddings → entity/relationship graph → AI-generated user profile
- **Intelligent decay**: facts fade over time based on type (events decay in 7 days, people stay sharp for 120 days); re-mentioning anything refreshes it
- **Interactive knowledge graph** — React Flow canvas showing entities and how they connect, colour-coded by type, with time-machine slider and search/filter
- **Planner** — Kanban board + natural-language task creation + AI daily plan
- **File vault** — local file browser with metadata search
- **Voice** — push-to-talk via browser Web Speech API
- **Gmail + Google Calendar** — read inbox, draft replies, check calendar events (OAuth, optional)
- **Google Drive** — browse and search your Drive files from the dashboard (OAuth, optional)
- **Email tab** — AI-powered email composition and inbox search
- **Telegram bot** — chat with LocalMind from your phone; proactive task reminders sent automatically when deadlines approach

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

# Local file vault directory
VAULT_PATH=./vault
```

---

## 5. Run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

Then run the SQL from step 3 in the Neon SQL Editor to add the pgvector column and HNSW index.

---

## 6. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The status dot in the sidebar shows Ollama's live status. If it's grey, start Ollama first:

```bash
ollama serve
```

---

## Google (Gmail + Calendar + Drive) — optional

Required for the Email tab and Google Drive tab.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable **Gmail API**, **Google Calendar API**, and **Google Drive API** (APIs & Services → Library)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
   - Application type: **Web Application**
   - Authorized redirect URIs: `http://localhost:3000/api/connectors/google/callback`
5. Copy the **Client ID** and **Client Secret** into `.env.local`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

6. Restart the dev server, then go to **Settings → Connections** and click **Connect Google**

---

## Telegram Bot — optional

Connect a Telegram bot to chat with LocalMind from your phone and receive proactive task reminders (tasks due within 2 hours trigger an automatic notification with memory context).

### Create the bot

1. Open Telegram and message **@BotFather**
2. Send `/newbot`, follow the prompts, copy the **token**
3. Add to `.env.local`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGabcdefg...
TELEGRAM_WEBHOOK_SECRET=some-random-secret-string
```

### Expose your local server (dev only)

Telegram needs a public HTTPS URL. Use [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# Copy the https://xxxx.ngrok-free.app URL
```

### Register the webhook

```bash
curl "http://localhost:3000/api/telegram/setup?url=https://xxxx.ngrok-free.app"
```

You should see `"ok": true`. Now message your bot on Telegram — it's live.

### Bot commands

| Command | Action |
|---|---|
| `/start` | Welcome + overview |
| `/memory` | Show what the AI knows about you |
| `/clear` | Reset conversation history |
| `/help` | Show all commands |

Or just talk naturally — the bot shares the same memory, tasks, and tools as the web chat.

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

| Layer | Table(s) | What's stored |
|-------|----------|---------------|
| L1 Episodic | `conversations`, `sessions` | Append-only conversation log |
| L2 Semantic | `embeddings` + pgvector | 768-dim embeddings, cosine similarity search |
| L3 Graph | `entities`, `relationships`, `atomic_facts` | Knowledge graph with versioned fact history and decay |
| L4 Profile | `profile` | ~500-token natural-language user summary |
| Identity | `user_profile` | Your name, email, social links — personalises every prompt |

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

### Proactive notifications

A background worker runs inside the Next.js process (via `src/instrumentation.ts`) and checks every 5 minutes for tasks due within 2 hours. When found, it looks up related entities in the knowledge graph and sends a context-aware Telegram message offering to pull up relevant notes or memory — automatically, without any user action.

---

## Database tables

| Table | Purpose |
|-------|---------|
| `conversations` | L1 — append-only message log |
| `sessions` | L1 — session metadata + summaries |
| `embeddings` | L2 — pgvector 768-dim chunks |
| `entities` | L3 — named entities with decay score |
| `relationships` | L3 — versioned fact edges with decay |
| `atomic_facts` | L3b — granular single-sentence facts with version chain |
| `profile` | L4 — AI-generated user summary |
| `user_profile` | Identity fields (name, email, social links) |
| `tasks` | Planner — Kanban tasks with due dates |
| `vault_files` | File vault — metadata for uploaded files |
| `settings` | KV store — OAuth tokens, Telegram sessions, config |
| `connectors` | Connector status — isActive, lastSyncAt, syncStatus |

---

## Stack

- **Next.js 16** App Router, TypeScript strict
- **Vercel AI SDK v6** (`ai` + `@ai-sdk/react` + `@ai-sdk/openai`)
- **Ollama** via OpenAI-compat `/v1` endpoint — qwen3:8b (chat), nomic-embed-text (embeddings)
- **Neon Postgres** + pgvector — single DB for all memory layers
- **Drizzle ORM** — all queries parameterized, drizzle-kit for migrations
- **React Flow** (`@xyflow/react`) — interactive knowledge graph with time-machine slider
- **Tailwind CSS v4** + shadcn/ui
- **Zustand** — global state
- **googleapis** + **google-auth-library** — Gmail, Calendar, Drive OAuth
- **Web Speech API** — browser-native push-to-talk voice input

---

## Project structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── overview/           # Dashboard home
│   ├── chat/               # Streaming chat with memory
│   ├── memory/             # Profile · Entities · Knowledge graph · Search
│   ├── planner/            # Kanban + AI daily plan
│   ├── files/              # Local file vault
│   ├── voice/              # Push-to-talk (Web Speech API)
│   ├── email/              # AI-powered Gmail interface
│   ├── drive/              # Google Drive browser
│   ├── settings/           # Profile · Connections · About
│   └── api/                # All API routes
├── agent/                  # Ollama client, prompt builder, entity extractor
├── memory/                 # 4-layer memory pipeline
│   ├── episodic.ts         # L1: conversation log
│   ├── semantic.ts         # L2: pgvector similarity search
│   ├── entity.ts           # L3: entity/relationship graph
│   ├── profile.ts          # L4: user profile summary
│   ├── decay.ts            # Intelligent decay engine
│   ├── hot.ts              # In-process TTL cache
│   └── index.ts            # Unified recall() + remember() API
├── connectors/             # Google OAuth, Google Drive, Telegram
├── lib/
│   └── notification-worker.ts  # Proactive Telegram task reminders
├── planner/                # Task CRUD + AI daily plan
├── vault/                  # File metadata + organizer
├── components/             # React components
└── db/
    ├── schema.ts           # Single Drizzle schema — all 12 tables
    └── migrations/         # SQL migration files
```

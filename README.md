# LocalMind

Personal AI agent running entirely on your machine. Persistent memory across conversations, knowledge graph extraction, and a full dashboard — no cloud AI, no subscriptions.

---

## What it does

- **Chat** with a local LLM (Qwen via Ollama) that remembers you across sessions, with a collapsible session sidebar to browse and replay past conversations
- **4-layer memory**: episodic log → semantic embeddings → entity/relationship graph → AI-generated user profile
- **Intelligent decay**: facts fade over time based on type (events decay in 7 days, people stay sharp for 120 days); re-mentioning anything refreshes it
- **Self-reflection**: every 20 interactions the AI analyses your conversation style and adjusts its tone automatically
- **Interactive knowledge graph** — React Flow canvas showing entities and how they connect, colour-coded by type, with time-machine slider and search/filter
- **Planner** — Kanban board + natural-language task creation + AI daily plan
- **File vault** — canvas folder view auto-categorized by AI on upload; list view with metadata search; source tracking (web / Telegram / email)
- **Email → Vault**: ask the AI to download attachments from any Gmail thread — files land in the vault, get AI-categorized, and appear in the canvas immediately
- **Voice** — push-to-talk via browser Web Speech API
- **Gmail + Google Calendar** — read inbox, draft replies, check calendar events (OAuth, optional)
- **Google Drive** — browse and search your Drive files from the dashboard (OAuth, optional)
- **Telegram bot** — full remote control from your phone: chat, save files, create tasks, search memory, and receive proactive task reminders

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

Required for email, calendar, and Drive features.

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

Chat with LocalMind from your phone and send files directly to your vault.

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
| `/start` | Welcome + full command overview |
| `/tasks` | Show all pending tasks with priority and due dates |
| `/vault` | List recent vault files with AI category |
| `/status` | Ollama health + file count + server time |
| `/note <text>` | Save a memory note via AI pipeline |
| `/remind <text>` | Create a task via AI pipeline |
| `/search <query>` | Search long-term memory |
| `/memory` | Show your full AI profile and key memories |
| `/clear` | Reset conversation history |
| `/help` | Full command reference |

**File uploads**: Send any document or photo to the bot — it's automatically downloaded, saved to your vault, and AI-categorized. The bot confirms receipt and sends a second message with the assigned category and summary.

---

## Email → Vault (AI attachment extraction)

With Gmail connected, ask the AI in chat:

> *"Download all attachments from the email Sarah sent me"*
> *"Save everything from subject: Project Proposal to my vault"*
> *"Extract files from emails from john@company.com"*

The AI calls `save_email_attachments`, walks the full MIME tree of matching emails, downloads every attachment via the Gmail API, saves each file to the vault, and fires async AI categorization. Files appear in the Vault canvas within seconds.

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
    ├─ Style note (self-reflection, 30 min TTL)   ← tone/style adaptation
    ├─ L2 Semantic search (pgvector, top-5)       ← relevant past context
    ├─ L3 Entity lookup (knowledge graph)         ← known facts about mentioned names
    │
    ▼
Ollama qwen3:8b → streaming response → user
    │
    └─ ASYNC post-response pipeline:
        L1  Log turn to conversations table
        L2  Embed combined text → pgvector (parallel with L3)
        L3  Extract entities/relationships → graph upsert (parallel with L2)
            └─ Reinforce decay scores for re-mentioned entities
        L4  Rebuild profile every 50 interactions
        Self-reflection every 20 interactions → style note stored in settings
        Decay cycle every 25 interactions (pure math, no LLM)
```

### Memory layers

| Layer | Table(s) | What's stored |
|-------|----------|---------------|
| L1 Episodic | `conversations`, `sessions` | Append-only conversation log + session summaries |
| L2 Semantic | `embeddings` + pgvector | 768-dim embeddings, cosine similarity search |
| L3 Graph | `entities`, `relationships`, `atomic_facts` | Knowledge graph with versioned fact history and decay |
| L4 Profile | `profile` | ~500-token natural-language user summary |
| Identity | `user_profile` | Your name, email, social links — personalises every prompt |
| Style | `settings` (`ai:style_profile`) | AI-generated tone/style instructions, updated every 20 turns |

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

### Vault AI categorization

Every file uploaded (web, Telegram, or email attachment) is automatically analyzed by Ollama after save:

- Text and code files: first 2000 chars are read and passed to the LLM
- Images: MIME type and filename used for inference
- Returns: `category`, `summary`, `tags` — written back to the DB asynchronously

Categories: **Finance, Code, Documents, Images, Notes, Archive, Media, Design, Data, Other**

### Proactive notifications

A background worker runs inside the Next.js process (via `src/instrumentation.ts`) and checks every 5 minutes for tasks due within 2 hours. When found, it looks up related entities in the knowledge graph and sends a context-aware Telegram message — automatically, without any user action.

---

## Database tables

| Table | Purpose |
|-------|---------|
| `conversations` | L1 — append-only message log |
| `sessions` | L1 — session metadata + AI-generated summaries |
| `embeddings` | L2 — pgvector 768-dim chunks |
| `entities` | L3 — named entities with decay score |
| `relationships` | L3 — versioned fact edges with decay |
| `atomic_facts` | L3b — granular single-sentence facts with version chain |
| `profile` | L4 — AI-generated user summary |
| `user_profile` | Identity fields (name, email, social links) |
| `tasks` | Planner — Kanban tasks with priority and due dates |
| `vault_files` | File vault — metadata, AI category, summary, source tracking |
| `settings` | KV store — OAuth tokens, Telegram sessions, style profile, config |
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
├── app/                         # Next.js App Router pages + API routes
│   ├── overview/                # Dashboard home — activity feed
│   ├── chat/                    # Streaming chat + session sidebar
│   ├── memory/                  # Profile · Entities · Knowledge graph · Search
│   ├── planner/                 # Kanban + AI daily plan
│   ├── files/                   # Vault — canvas folder view + list view
│   ├── voice/                   # Push-to-talk (Web Speech API)
│   ├── email/                   # AI-powered Gmail interface
│   ├── drive/                   # Google Drive browser
│   ├── settings/                # Profile · Connections · About
│   └── api/
│       ├── chat/                # Streaming chat route (streamText + tools)
│       ├── sessions/            # Session list, create, delete, transcript
│       ├── memory/              # Profile, entities, search, decay-stats
│       ├── files/               # Upload, list, canvas (grouped by category)
│       ├── tasks/               # Task CRUD
│       ├── health/              # Ollama health + model info + latency stats
│       ├── telegram/webhook/    # Telegram bot message + file handler
│       └── connectors/          # Google OAuth, status, disconnect
├── agent/
│   ├── ollama.ts                # chatModel + extractionModel via Ollama /v1
│   ├── prompt-builder.ts        # System prompt: profile + memories + style
│   ├── extract.ts               # Entity/relationship extraction via generateObject
│   └── tools.ts                 # All AI tools: memory, tasks, Gmail, Drive, vault
├── memory/
│   ├── episodic.ts              # L1: log, sessions, getSessionList, deleteSession
│   ├── semantic.ts              # L2: embedAndStore, searchSimilar (pgvector)
│   ├── entity.ts                # L3: upsertEntity, upsertRelationship
│   ├── profile.ts               # L4: buildProfile, getStyleNote, runSelfReflection
│   ├── decay.ts                 # Decay engine: computeDecayScore, reinforceEntity
│   ├── hot.ts                   # In-process TTL cache (sub-ms reads)
│   └── index.ts                 # recall(), remember(), recallFast() — parallel retrieval
├── connectors/
│   ├── google-auth.ts           # OAuth2 lifecycle: tokens, refresh, status
│   ├── google-drive.ts          # Drive API: list, search, content export
│   └── telegram.ts              # Bot API: send, download, session, history
├── vault/
│   ├── indexer.ts               # indexFile, listFiles, getFilesByCategory, updateFileAnalysis
│   └── analyzer.ts              # AI file analysis: category + summary + tags
├── lib/
│   ├── model-advisor.ts         # TTFT tracking + Ollama quantization advisor
│   └── notification-worker.ts  # Proactive Telegram task reminders (5-min poll)
├── planner/
│   ├── tasks.ts                 # Task CRUD
│   └── ai-planner.ts            # generateDailyPlan, parseNaturalLanguageTask
└── db/
    ├── schema.ts                # Single Drizzle schema — all 12 tables
    └── migrations/              # SQL migration files (drizzle-kit generated)
```

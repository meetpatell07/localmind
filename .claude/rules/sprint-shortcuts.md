# Rules: Sprint Shortcuts

## Voice (Sprint 1: use browser APIs as fast fallback)
- FAST PATH: Web Speech API for STT (navigator.mediaDevices + SpeechRecognition)
- FAST PATH: window.speechSynthesis for TTS
- These are FREE, ZERO SETUP, work in Chrome/Edge
- Upgrade to Whisper.cpp + Piper in week 2 for offline support
- Voice tab: push-to-talk button, transcript display, speak response toggle

## Planner
- Tasks in Neon `tasks` table via Drizzle
- Basic Kanban with drag-and-drop (@hello-pangea/dnd)
- Natural language: "remind me to X on Thursday" → parse date + create task
- AI daily plan: hit Ollama with tasks + profile → get prioritized list
- Statuses: todo | in_progress | done | cancelled
- Skip recurring tasks in sprint 1

## File Vault
- Upload to local `vault/` directory (gitignored)
- Store metadata in `vault_files` table
- Basic file browser in Files tab
- Skip content embedding in sprint 1 — just list/search by filename
- Add full RAG indexing in week 2

## Security (Sprint 1 Minimum)
- Bind to 127.0.0.1 only
- DATABASE_URL in .env.local, in .gitignore
- No secrets in code or logs
- No auth needed (localhost only)
- Sanitize LLM output before rendering (react-markdown handles this)

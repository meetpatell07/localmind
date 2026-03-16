# Architecture

```
┌─────────────────────────────────────────┐
│  Next.js Dashboard (tabs)              │ ← User
├─────────────────────────────────────────┤
│  Agent (prompt builder + extractors)    │
├─────────────────────────────────────────┤
│  Memory: 4 layers, all in Neon Postgres │
│  L1 Episodic │ L2 Semantic (pgvector)  │
│  L3 Entities │ L4 Profile summary      │
├─────────────────────────────────────────┤
│  Ollama localhost:11434                 │ ← Brain
└─────────────────────────────────────────┘
```

## Data Flow Per Message
1. User sends message
2. Load L4 profile (cached) + L2 top-5 similar memories + L3 relevant entities
3. Build prompt → send to Ollama → stream response
4. Async post-response: L1 log → L2 embed → L3 extract entities → L4 rebuild if needed

## Sprint 1 Decisions
- One DB (Neon) for speed — split to hybrid local+cloud in week 2
- No auth (localhost only, single user)
- Browser Web Speech API as voice fallback if Whisper.cpp setup takes too long
- Skip messaging integrations — dashboard chat only
- Skip Gmail/Calendar MCP — filesystem MCP only

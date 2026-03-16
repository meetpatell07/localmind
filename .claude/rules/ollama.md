# Rules: Ollama

- Base: `http://localhost:11434` (OLLAMA_BASE_URL env)
- Chat: `/v1/chat/completions` with `stream: true` always
- Embeddings: `/api/embeddings` model `nomic-embed-text` (768 dims)
- Default model: `qwen2.5:7b` (OLLAMA_MODEL env)
- `keep_alive: "24h"` to keep model hot
- Wrap ALL calls in try/catch — server may be offline
- On connection refused: return `{ status: "offline" }`, UI shows banner, retry 3s
- On timeout (>30s): cancel, log error, retry shorter prompt
- ALWAYS null-check `response.message.content` — undefined on error
- Temperature: 0.7 chat, 0.0 extraction, 1.0 creative
- Entity extraction: system prompt with JSON schema example + Zod validation on output
- Health check: `GET /` → 200 when running

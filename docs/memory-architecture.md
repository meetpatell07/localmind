# Memory Architecture — Four Layers, One Postgres

All memory in a single Neon Postgres with pgvector. One Drizzle schema, one connection.

## L1: Episodic (conversations table)
- Append-only conversation log with timestamps + channel
- Never update, never delete — audit trail
- Store every user + assistant turn

## L2: Semantic (embeddings table + pgvector)
- Embedded chunks via Ollama nomic-embed-text (768 dims)
- Chunking: 512 tokens, 50-token overlap
- HNSW index, cosine similarity, top 5 results
- Covers: conversations, documents, notes

## L3: Entity/Relationship (entities + relationships tables)
- Knowledge graph lite in Postgres — no Neo4j needed
- After each conversation: extract entities + relationships via Ollama structured output
- Zod-validate extraction output — drop malformed silently
- On contradiction: deactivate old relationship, insert new
- Fuzzy dedup on entity names (case-insensitive)

## L4: Profile (profile table)
- Pre-computed ~500-token user summary
- Rebuild every 50 interactions or on request
- Aggregates: top entities + active relationships + recent facts
- Cached in-memory between requests, reload on restart
- Injected into EVERY system prompt

## Per-Message Flow
```
1. Load L4 profile (cached)
2. L2: top-5 similar memories to user message
3. L3: entity lookup if message mentions known entities
4. Build prompt → Ollama via AI SDK streamText()
5. Stream response to user
6. ASYNC post-response: L1 log → L2 embed → L3 extract → maybe L4 rebuild
```

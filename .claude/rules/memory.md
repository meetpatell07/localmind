# Rules: Memory (4 Layers)

- All layers in Neon Postgres for sprint 1 — migrate sensitive layers to local SQLite week 2
- Memory ops are POST-RESPONSE, ASYNC — never block the user's response
- Pipeline: respond first → async: L1 log → L2 embed → L3 extract → maybe L4 rebuild

## L1 Episodic
- Append-only, never update/delete
- Store every turn: user + assistant messages with token count and channel

## L2 Semantic
- Embed conversation + document chunks via Ollama nomic-embed-text (768 dims)
- Chunk: 512 tokens, 50-token overlap
- Search: cosine similarity via pgvector, top 5 results
- Filter by source_type when appropriate

## L3 Entity/Relationship
- Post-conversation: extract entities + relationships via Ollama structured output
- Validate with Zod — malformed output silently dropped
- Deduplicate: case-insensitive name match before creating
- On contradiction: set old relationship `is_active: false`, insert new

## L4 Profile
- Rebuild every 50 interactions or on user request
- Aggregate: top entities + active relationships + recent facts → Ollama summarizes to ~500 tokens
- Cache in Node.js memory between requests
- Single row in profile table, update in-place
- Inject into system prompt on every request

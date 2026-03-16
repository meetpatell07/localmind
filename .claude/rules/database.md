# Rules: Database (Neon + Drizzle)

- Driver: `@neondatabase/serverless` + `drizzle-orm/neon-serverless`
- Connection: DATABASE_URL from .env.local, always `?sslmode=require`
- Schema source of truth: `src/db/schema.ts`
- Migrations: `pnpm db:generate` → `pnpm db:migrate`
- pgvector: add extension + vector column + HNSW index via raw SQL after first migration
- Embedding dimension: 768 (Ollama nomic-embed-text)
- Similarity search: `SELECT *, 1-(embedding <=> $1::vector) AS similarity FROM embeddings ORDER BY embedding <=> $1::vector LIMIT 5;`
- Use Drizzle query builder everywhere — raw SQL only for pgvector ops (use `db.execute(sql)`)
- Transactions: `db.transaction()` for multi-table writes
- JSON columns: typed with `$type<T>()`, validated with Zod at runtime
- UUIDs for all PKs, `timestamp with time zone` for all dates
- Never hard delete — use `is_active: boolean` for soft delete

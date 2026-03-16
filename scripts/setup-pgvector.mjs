import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(url);

await sql`CREATE EXTENSION IF NOT EXISTS vector`;
console.log("✓ pgvector extension created");

await sql`ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding vector(768)`;
console.log("✓ vector(768) column added");

await sql`CREATE INDEX IF NOT EXISTS embed_hnsw_idx ON embeddings USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`;
console.log("✓ HNSW index created");

import { db } from "@/db";
import { embeddings } from "@/db/schema";
import { OLLAMA_BASE_URL, EMBEDDING_MODEL, SIMILARITY_TOP_K } from "@/shared/constants";
import { sql } from "drizzle-orm";

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding ?? null;
  } catch {
    return null;
  }
}

export async function embedAndStore(
  content: string,
  sourceType: string,
  sourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const embedding = await getEmbedding(content);
  if (!embedding) return;

  const vectorStr = `[${embedding.join(",")}]`;

  // Insert base row first, then update with vector via raw SQL
  const [row] = await db
    .insert(embeddings)
    .values({ contentText: content, sourceType, sourceId, metadata })
    .returning({ id: embeddings.id });

  if (!row) return;

  await db.execute(
    sql`UPDATE embeddings SET embedding = ${vectorStr}::vector WHERE id = ${row.id}`
  );
}

export async function searchSimilar(
  query: string,
  limit = SIMILARITY_TOP_K
): Promise<string[]> {
  const embedding = await getEmbedding(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await db.execute<{ content_text: string }>(
    sql`SELECT content_text FROM embeddings WHERE embedding IS NOT NULL ORDER BY embedding <=> ${vectorStr}::vector LIMIT ${limit}`
  );

  return rows.rows.map((r) => r.content_text);
}

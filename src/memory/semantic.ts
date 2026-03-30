import { db } from "@/db";
import { embeddings } from "@/db/schema";
import { SIMILARITY_TOP_K } from "@/shared/constants";
import { sql } from "drizzle-orm";
import { getDocumentEmbedding, getQueryEmbedding } from "@/lib/embeddings";

export async function embedAndStore(
  content: string,
  sourceType: string,
  sourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const embedding = await getDocumentEmbedding(content);
  if (!embedding) return;

  const vectorStr = `[${embedding.join(",")}]`;

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
  const embedding = await getQueryEmbedding(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await db.execute<{ content_text: string }>(
    sql`SELECT content_text FROM embeddings WHERE embedding IS NOT NULL ORDER BY embedding <=> ${vectorStr}::vector LIMIT ${limit}`
  );

  return rows.rows.map((r) => r.content_text);
}

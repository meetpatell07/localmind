/**
 * Local embeddings via @huggingface/transformers (Transformers.js / ONNX).
 * Model: nomic-ai/nomic-embed-text-v1 — 768-dim, matches the pgvector schema.
 *
 * Uses feature-extraction (not sentence-similarity) because we need raw
 * embedding vectors to store and query in pgvector. The sentence-similarity
 * pipeline returns scores, not vectors.
 *
 * nomic-embed-text requires task prefixes for best quality:
 *   - Store chunks:  "search_document: <text>"
 *   - Query search:  "search_query: <text>"
 *
 * The pipeline is a singleton cached on globalThis so it survives Next.js
 * HMR reloads without reloading the ONNX model from disk every request.
 */

import { pipeline } from "@huggingface/transformers";

type EmbedPipeline = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

const g = globalThis as typeof globalThis & {
  __embedPipeline?: EmbedPipeline;
  __embedPipelineLoading?: Promise<EmbedPipeline>;
};

async function getPipeline(): Promise<EmbedPipeline> {
  // Already loaded
  if (g.__embedPipeline) return g.__embedPipeline;

  // Prevent parallel initializations — share the same promise
  if (!g.__embedPipelineLoading) {
    g.__embedPipelineLoading = pipeline("feature-extraction", "nomic-ai/nomic-embed-text-v1", {
      dtype: "fp32",
    }).then((p) => {
      g.__embedPipeline = p as EmbedPipeline;
      delete g.__embedPipelineLoading;
      return g.__embedPipeline;
    });
  }

  return g.__embedPipelineLoading;
}

async function embed(prefixedText: string): Promise<number[] | null> {
  try {
    const pipe = await getPipeline();
    const output = await pipe(prefixedText, { pooling: "mean", normalize: true });
    // output.data is a Float32Array of length 768
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.error("[embeddings]", err);
    return null;
  }
}

/** Embed text that will be stored in the vector DB (document prefix). */
export function getDocumentEmbedding(text: string): Promise<number[] | null> {
  return embed(`search_document: ${text}`);
}

/** Embed a user query before vector search (query prefix). */
export function getQueryEmbedding(text: string): Promise<number[] | null> {
  return embed(`search_query: ${text}`);
}

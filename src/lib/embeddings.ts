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

// Dynamic import so edge runtime can import this file without bundling ONNX.
// On Cloudflare Workers the dynamic require will fail at runtime and both
// exported functions return null — the memory pipeline handles null gracefully.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineFn = (task: string, model: string, opts?: Record<string, unknown>) => Promise<any>;

let _pipeline: PipelineFn | null = null;
async function getPipelineFn(): Promise<PipelineFn | null> {
  if (_pipeline !== null) return _pipeline;
  try {
    // Dynamic import — Node.js only; edge runtime will throw here
    const mod = await import("@huggingface/transformers");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _pipeline = mod.pipeline as unknown as PipelineFn;
  } catch {
    _pipeline = null;
  }
  return _pipeline;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EmbedPipeline = any;

const g = globalThis as typeof globalThis & {
  __embedPipeline?: EmbedPipeline;
  __embedPipelineLoading?: Promise<EmbedPipeline>;
};

async function getPipeline(): Promise<EmbedPipeline | null> {
  if (g.__embedPipeline) return g.__embedPipeline;
  if (!g.__embedPipelineLoading) {
    g.__embedPipelineLoading = (async () => {
      const pipelineFn = await getPipelineFn();
      if (!pipelineFn) return null;
      const p = await pipelineFn("feature-extraction", "nomic-ai/nomic-embed-text-v1", { dtype: "fp32" });
      g.__embedPipeline = p;
      delete g.__embedPipelineLoading;
      return g.__embedPipeline;
    })();
  }
  return g.__embedPipelineLoading!;
}

async function embed(prefixedText: string): Promise<number[] | null> {
  try {
    const pipe = await getPipeline();
    if (!pipe) return null;
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

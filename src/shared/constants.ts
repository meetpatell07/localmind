// ── Ollama (used for embeddings only) ────────────────────────────────────────
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

// ── Groq (used for chat + extraction) ────────────────────────────────────────
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
export const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
// EMBEDDING_MODEL is no longer used — embeddings run locally via @huggingface/transformers
// using nomic-ai/nomic-embed-text-v1 (ONNX, 768-dim)
export const EMBEDDING_DIMS = 768;

export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 50;
export const SIMILARITY_TOP_K = 5;

export const PROFILE_REBUILD_INTERVAL = 50;    // interactions
export const SELF_REFLECTION_INTERVAL = 20;    // analyze tone/style every N messages
export const MAX_PROFILE_TOKENS = 500;

export const CHAT_TEMPERATURE = 0.7;
export const EXTRACTION_TEMPERATURE = 0.0;

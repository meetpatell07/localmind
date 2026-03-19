export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "nomic-embed-text";
export const EMBEDDING_DIMS = 768;

export const CHUNK_SIZE = 512;
export const CHUNK_OVERLAP = 50;
export const SIMILARITY_TOP_K = 5;

export const PROFILE_REBUILD_INTERVAL = 50;    // interactions
export const SELF_REFLECTION_INTERVAL = 20;    // analyze tone/style every N messages
export const MAX_PROFILE_TOKENS = 500;

export const CHAT_TEMPERATURE = 0.7;
export const EXTRACTION_TEMPERATURE = 0.0;

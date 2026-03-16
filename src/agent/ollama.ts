import { createOpenAI } from "@ai-sdk/openai";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "@/shared/constants";

// Ollama exposes an OpenAI-compatible API at /v1
const ollamaProvider = createOpenAI({
  baseURL: `${OLLAMA_BASE_URL}/v1`,
  apiKey: "ollama", // required by the client, ignored by Ollama
});

export const chatModel = ollamaProvider(OLLAMA_MODEL);
export const extractionModel = ollamaProvider(OLLAMA_MODEL);

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_BASE_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

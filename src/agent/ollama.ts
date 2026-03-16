import { createOllama } from "ollama-ai-provider";
import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "@/shared/constants";

export const ollama = createOllama({
  baseURL: `${OLLAMA_BASE_URL}/api`,
});

export const chatModel = ollama(OLLAMA_MODEL);

export const extractionModel = ollama(OLLAMA_MODEL);

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_BASE_URL, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

import { createOpenAI } from "@ai-sdk/openai";
import { GROQ_BASE_URL, GROQ_API_KEY, GROQ_MODEL } from "@/shared/constants";

// Groq exposes an OpenAI-compatible API at https://api.groq.com/openai/v1
const groqProvider = createOpenAI({
  baseURL: GROQ_BASE_URL,
  apiKey: GROQ_API_KEY,
});

export const chatModel = groqProvider.chat(GROQ_MODEL);

// Use a fast model for structured extraction
const extractionModelName = process.env.GROQ_EXTRACTION_MODEL ?? "llama-3.1-8b-instant";
export const extractionModel = groqProvider.chat(extractionModelName);

export async function checkOllamaHealth(): Promise<boolean> {
  // Groq is a cloud API — available as long as the key is configured.
  return GROQ_API_KEY.length > 0;
}

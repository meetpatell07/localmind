import { generateText } from "ai";
import { extractionModel } from "./ollama";
import { buildExtractionPrompt } from "./prompt-builder";
import { ExtractedEntitiesSchema, type ExtractedEntitiesInput } from "@/shared/schemas";
import { EXTRACTION_TEMPERATURE } from "@/shared/constants";

export async function extractEntitiesFromConversation(
  userMessage: string,
  assistantMessage: string
): Promise<ExtractedEntitiesInput | null> {
  const conversation = `User: ${userMessage}\nAssistant: ${assistantMessage}`;
  const prompt = buildExtractionPrompt(conversation);

  try {
    const { text } = await generateText({
      model: extractionModel,
      prompt,
      temperature: EXTRACTION_TEMPERATURE,
    });

    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;

    const parsed: unknown = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    const result = ExtractedEntitiesSchema.safeParse(parsed);
    if (!result.success) return null;

    return result.data;
  } catch {
    // Silently drop malformed output per spec
    return null;
  }
}

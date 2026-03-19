import { checkOllamaHealth } from "@/agent/ollama";
import { checkModelInfo, getAverageTTFT } from "@/lib/model-advisor";
import { OLLAMA_MODEL } from "@/shared/constants";

export async function GET(): Promise<Response> {
  const [online, modelInfo] = await Promise.all([
    checkOllamaHealth(),
    checkModelInfo(),
  ]);

  const avgTtftMs = getAverageTTFT();

  return Response.json(
    {
      online,
      model: {
        name: OLLAMA_MODEL,
        quantizationLevel: modelInfo.quantizationLevel,
        parameterSize:     modelInfo.parameterSize,
        family:            modelInfo.family,
        isHeavyPrecision:  modelInfo.isHeavyPrecision,
        suggestion:        modelInfo.suggestion,
        avgTtftMs,
        // true when average TTFT across last 10 requests exceeded 10 s
        slowLatency: avgTtftMs !== null && avgTtftMs > 10_000,
      },
      timestamp: new Date().toISOString(),
    },
    { status: online ? 200 : 503 },
  );
}

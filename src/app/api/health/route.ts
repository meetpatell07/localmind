export const runtime = 'edge';
import { checkOllamaHealth } from "@/agent/ollama";
import { checkModelInfo, getAverageTTFT } from "@/lib/model-advisor";
import { GROQ_MODEL } from "@/shared/constants";

export async function GET(): Promise<Response> {
  const [onlineResult, modelInfoResult] = await Promise.allSettled([
    checkOllamaHealth(),
    checkModelInfo(),
  ]);
  const online = onlineResult.status === "fulfilled" ? onlineResult.value : false;
  const modelInfo = modelInfoResult.status === "fulfilled"
    ? modelInfoResult.value
    : { quantizationLevel: null, parameterSize: null, family: null, isHeavyPrecision: false, suggestion: null };

  const avgTtftMs = getAverageTTFT();

  return Response.json(
    {
      online,
      model: {
        name: GROQ_MODEL,
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

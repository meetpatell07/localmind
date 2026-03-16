import { checkOllamaHealth } from "@/agent/ollama";

export async function GET(): Promise<Response> {
  const online = await checkOllamaHealth();
  return Response.json(
    { online, timestamp: new Date().toISOString() },
    { status: online ? 200 : 503 }
  );
}

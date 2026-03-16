import { streamText } from "ai";
import { chatModel } from "@/agent/ollama";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recall, remember, createSession } from "@/memory";
import { z } from "zod";

const MessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })
  .passthrough(); // AI SDK sends extra fields like id, createdAt

const RequestSchema = z.object({
  messages: z.array(MessageSchema),
  sessionId: z.string().uuid().nullish(),
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { messages, sessionId: incomingSessionId } = parsed.data;

  const userMessage = messages.at(-1);
  if (!userMessage || userMessage.role !== "user") {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  // Ensure session exists
  const sessionId = incomingSessionId ?? (await createSession());

  let memoryCtx;
  try {
    memoryCtx = await recall(userMessage.content);
  } catch {
    memoryCtx = { profile: null, relevantMemories: [], relevantEntities: [] };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);

  let result;
  try {
    result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages,
      temperature: 0.7,
      onFinish: async ({ text }) => {
        // Post-response async: persist to memory layers
        try {
          await remember(sessionId, userMessage.content, text);
        } catch {
          // Non-fatal
        }
      },
    });
  } catch {
    return Response.json(
      { error: "AI offline", status: "offline" },
      { status: 503 }
    );
  }

  const response = result.toDataStreamResponse();

  // Surface sessionId to client via header
  const headers = new Headers(response.headers);
  headers.set("X-Session-Id", sessionId);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

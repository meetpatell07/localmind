import { streamText, convertToCoreMessages } from "ai";
import type { Message } from "ai";
import { chatModel } from "@/agent/ollama";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recall, remember, createSession } from "@/memory";
import { z } from "zod";

const RequestSchema = z.object({
  // Accept the full AI SDK Message shape — id, createdAt, content, role, etc.
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system", "data"]),
      content: z.string(),
      createdAt: z.coerce.date().optional(),
    }).passthrough()
  ),
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
    return Response.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { messages, sessionId: incomingSessionId } = parsed.data;

  // Get the last user message for memory ops
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  const sessionId = incomingSessionId ?? (await createSession());

  // Recall memory context (non-blocking on failure)
  let memoryCtx;
  try {
    memoryCtx = await recall(lastUserMsg.content);
  } catch {
    memoryCtx = { profile: null, relevantMemories: [], relevantEntities: [] };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);

  // Convert AI SDK UIMessages → CoreMessages for streamText
  const coreMessages = convertToCoreMessages(messages as Message[]);

  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: coreMessages,
    temperature: 0.7,
    onFinish: async ({ text }) => {
      // Post-response async: L1 log → L2 embed → L3 extract → L4 profile
      try {
        await remember(sessionId, lastUserMsg.content, text);
      } catch {
        // Non-fatal — never block the response pipeline
      }
    },
  });

  const response = result.toDataStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Session-Id", sessionId);

  return new Response(response.body, { status: response.status, headers });
}

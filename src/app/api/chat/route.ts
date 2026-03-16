import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recall, remember, createSession } from "@/memory";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string().optional().default(""),
    parts: z.array(z.any()).optional(),
  }).passthrough()),
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

  // Extract text from the last user message (parts or content)
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  // v6 UIMessage: text lives in parts[].text; fall back to content for compat
  const userText: string = (() => {
    if (lastUserMsg.parts) {
      const textPart = (lastUserMsg.parts as Array<{type: string; text?: string}>)
        .find((p) => p.type === "text");
      if (textPart?.text) return textPart.text;
    }
    return (lastUserMsg.content as string) ?? "";
  })();

  const sessionId = incomingSessionId ?? (await createSession());

  // Recall memory context
  let memoryCtx;
  try {
    memoryCtx = await recall(userText);
  } catch {
    memoryCtx = {
      profile: null,
      relevantMemories: [],
      relevantEntities: [],
      recentHistory: [],
      sessionSummaries: [],
    };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);

  // v6: convertToModelMessages (was convertToCoreMessages in v4)
  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: modelMessages,
    temperature: 0.7,
    onFinish: async ({ text }) => {
      try {
        await remember(sessionId, userText, text);
      } catch {
        // Non-fatal
      }
    },
  });

  // v6: toUIMessageStreamResponse (was toDataStreamResponse in v4)
  const response = result.toUIMessageStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Session-Id", sessionId);

  return new Response(response.body, { status: response.status, headers });
}

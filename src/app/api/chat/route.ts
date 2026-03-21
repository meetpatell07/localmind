import { streamText, convertToModelMessages, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recallFast, remember, createSession } from "@/memory";
import { coreTools, driveTools, vaultAttachmentTool } from "@/agent/tools";
import { getNotionTools } from "@/connectors/notion-mcp";
import { recordTTFT } from "@/lib/model-advisor";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string().optional(),
      role: z.enum(["user", "assistant", "system"]),
      content: z.string().optional().default(""),
      parts: z.array(z.any()).optional(),
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

  // Extract the last user message text (v6 parts or legacy content)
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  const userText: string = (() => {
    if (lastUserMsg.parts) {
      const textPart = (lastUserMsg.parts as Array<{ type: string; text?: string }>)
        .find((p) => p.type === "text");
      if (textPart?.text) return textPart.text;
    }
    return (lastUserMsg.content as string) ?? "";
  })();

  const sessionId = incomingSessionId ?? (await createSession());

  // Fast context — only hot-cached data (~0 ms when warm).
  // The AI fetches deeper context on demand via recall_memories tool.
  let memoryCtx;
  try {
    memoryCtx = await recallFast();
  } catch {
    memoryCtx = {
      userIdentity: null,
      profile: null,
      relevantMemories: [],
      relevantEntities: [],
      recentHistory: [],
      sessionSummaries: [],
      styleNote: null,
    };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);
  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  // ── Streaming Buffer ───────────────────────────────────────────────────────
  // createDataStreamResponse opens the HTTP response immediately — the client
  // receives the stream start and our "thinking" annotation before Ollama
  // generates a single token. This eliminates the blank-screen warmup period.
  const requestStart = Date.now();
  let firstTokenRecorded = false;

  // Load Notion MCP tools (empty object if not connected)
  const notionTools = await getNotionTools();

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: chatModel,
        system: systemPrompt,
        messages: modelMessages,
        tools: { ...coreTools, ...driveTools, save_email_attachments: vaultAttachmentTool, ...notionTools },
        stopWhen: stepCountIs(5),
        temperature: 0.7,
        onChunk: () => {
          // Measure time-to-first-token once per request
          if (!firstTokenRecorded) {
            firstTokenRecorded = true;
            recordTTFT(Date.now() - requestStart);
          }
        },
        onFinish: async ({ text }) => {
          try {
            await remember(sessionId, userText, text);
          } catch {
            // Non-fatal — memory pipeline failure never blocks the user
          }
        },
      });

      // toUIMessageStream() is the correct pipe method for this SDK version.
      // The HTTP response (createUIMessageStreamResponse) is already open before
      // Ollama generates the first token — client sees TTFB immediately.
      writer.merge(result.toUIMessageStream());
    },
    onError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Session-Id": sessionId },
  });
}

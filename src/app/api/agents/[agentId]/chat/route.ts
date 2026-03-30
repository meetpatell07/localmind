import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recallFast, createSession } from "@/memory";
import { coreTools, emailTools, driveTools, vaultAttachmentTool } from "@/agent/tools";
import { getAgentById } from "@/agent/agent-definitions";
import type { ToolSet } from "ai";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z.array(
    z
      .object({
        id: z.string().optional(),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().optional().default(""),
        parts: z.array(z.any()).optional(),
      })
      .passthrough()
  ),
  sessionId: z.string().uuid().nullish(),
});

// Map agent tool keys to actual tool objects
function resolveTools(toolKeys: string[]): ToolSet {
  const allAvailable: ToolSet = {
    ...coreTools,
    ...emailTools,
    ...driveTools,
    save_email_attachments: vaultAttachmentTool,
  };

  const resolved: ToolSet = {};
  for (const key of toolKeys) {
    if (key in allAvailable) {
      resolved[key] = allAvailable[key];
    }
  }
  return resolved;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
): Promise<Response> {
  const { agentId } = await params;

  const agent = getAgentById(agentId);
  if (!agent) {
    return Response.json({ error: `Unknown agent: ${agentId}` }, { status: 404 });
  }

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

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUserMsg) {
    return Response.json({ error: "No user message" }, { status: 400 });
  }

  const sessionId = incomingSessionId ?? (await createSession());

  // Load hot-cached memory context
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

  // Build prompt with agent-specific system prompt injected
  const systemPrompt = buildSystemPrompt(memoryCtx, undefined, agent.systemPrompt);
  const modelMessages = await convertToModelMessages(messages as UIMessage[]);
  const tools = resolveTools(agent.toolKeys);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: chatModel,
        system: systemPrompt,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(8),
        temperature: 0.7,
        onFinish: async () => {
          // Agent conversations don't go through the full memory pipeline —
          // they use the core memory tools inline during the conversation.
        },
      });
      writer.merge(result.toUIMessageStream());
    },
    onError: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Session-Id": sessionId },
  });
}

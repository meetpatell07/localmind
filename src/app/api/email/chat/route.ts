import { streamText, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { emailTools } from "@/connectors/gmail-tools";
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
});

const EMAIL_SYSTEM_PROMPT = `You are LocalMind's Email Assistant — an AI that can read, search, and act on the user's Gmail inbox.

You have access to the following tools:
- list_emails: List recent emails from the inbox
- search_emails: Search Gmail using query syntax (from:, subject:, is:unread, after:, has:attachment, etc.)
- get_email: Fetch the full body of a specific email by ID
- create_task: Create a Planner task from email context

Guidelines:
- ONLY use tools when explicitly asked. Never proactively read emails without a request.
- When asked to summarize or read emails, always call list_emails or search_emails first to get IDs, then get_email for full content if needed.
- When asked to create a task from an email, extract a clear actionable title and relevant details, set priority based on urgency.
- If Gmail is not connected, tell the user to connect it in Settings.
- Be concise — summarize long emails, highlight what matters.
- Respect the user's privacy — don't volunteer email contents unless asked.`;

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

  const { messages } = parsed.data;

  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  const result = streamText({
    model: chatModel,
    system: EMAIL_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: emailTools,
    maxSteps: 5,
    temperature: 0.3,
  });

  return result.toUIMessageStreamResponse();
}

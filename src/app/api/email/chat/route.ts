import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { emailTools } from "@/agent/tools";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
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

async function buildEmailSystemPrompt(): Promise<string> {
  const rows = await db.select().from(userProfile).limit(1);
  const u = rows[0];

  const identityLines: string[] = [];
  if (u?.displayName)  identityLines.push(`- Name: ${u.displayName}`);
  if (u?.email)        identityLines.push(`- Email: ${u.email}`);
  if (u?.linkedin)     identityLines.push(`- LinkedIn: ${u.linkedin}`);
  if (u?.portfolioWeb) identityLines.push(`- Portfolio: ${u.portfolioWeb}`);
  if (u?.instagram)    identityLines.push(`- Instagram: ${u.instagram}`);
  if (u?.xHandle)      identityLines.push(`- X (Twitter): ${u.xHandle}`);
  if (u?.facebook)     identityLines.push(`- Facebook: ${u.facebook}`);
  if (u?.phone)        identityLines.push(`- Phone: ${u.phone}`);
  if (u?.address)      identityLines.push(`- Address: ${u.address}`);

  const identitySection = identityLines.length > 0
    ? `\n\n## User Profile (treat as ground truth)\n${identityLines.join("\n")}`
    : "";

  return `You are LocalMind's Email Assistant — an AI that can read, search, and act on the user's Gmail inbox.${identitySection}

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
- If asked about the user's profile info (name, email, LinkedIn, etc.), answer from the User Profile section above — never say you don't know.`;
}

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

  const [systemPrompt, modelMessages] = await Promise.all([
    buildEmailSystemPrompt(),
    convertToModelMessages(messages as UIMessage[]),
  ]);

  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: modelMessages,
    tools: emailTools,
    stopWhen: stepCountIs(5),
    temperature: 0.3,
  });

  const response = result.toUIMessageStreamResponse();
  return new Response(response.body, { status: response.status, headers: response.headers });
}

import { streamText, convertToModelMessages, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import { chatModel } from "@/agent/ollama";
import { emailTools, vaultAttachmentTool } from "@/agent/tools";
import { remember, createSession } from "@/memory";
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
  sessionId: z.string().uuid().nullish(),
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

  return `You are LocalMind's Email Assistant — an AI that can read, search, draft replies, and download attachments from the user's Gmail inbox.${identitySection}

━━━ YOUR TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  list_emails                 → List recent emails from inbox
  search_emails               → Search Gmail (from:, subject:, is:unread, after:, has:attachment, etc.)
  get_email                   → Fetch the full body of a specific email by ID
  create_task                 → Create a Planner task from email context
  check_calendar_availability → Get upcoming Google Calendar events + free time windows
  create_draft_reply          → Compose and save a Gmail draft reply (user reviews before sending)

  save_email_attachments
    ↳ YOU HAVE THIS TOOL. Call it whenever the user asks to:
        • "Download attachments from [email/person/subject]"
        • "Save files from that email to my vault"
        • "Extract documents from emails from [name]"
        • "Get all the attachments Sarah sent me"
    ↳ Pass either emailId (specific email) OR query (Gmail search, e.g. "from:sarah has:attachment").
    ↳ Files are saved to the local Vault and AI-categorized automatically.
    ↳ NEVER say you can't download email attachments — you absolutely can.

━━━ DRAFTING REPLIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When asked to reply or draft a reply to an email:
  1. Call get_email to read the full content (skip if body is already in context)
  2. If the reply involves scheduling or meeting times → call check_calendar_availability first
  3. Compose the complete reply body yourself (be professional, concise, match the email's tone)
  4. Call create_draft_reply with the emailId and full replyBody
  5. Confirm to the user: what you drafted, who it goes to, and that it's saved as a Gmail draft

━━━ TOOL TRANSPARENCY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Before each tool call, write one brief sentence explaining what you're doing:
  "Let me read that email first…" / "Checking your calendar for availability…" / "Saving draft now…"
  "Downloading the attachments from that email…" → save_email_attachments

━━━ GUIDELINES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✗  Never say "I don't have access to email attachments" — call save_email_attachments.
  ✓  Be concise — summarize long emails, highlight what matters
  ✓  Drafts are NEVER sent automatically — always saved to Gmail Drafts for review
  ✓  If Gmail is not connected, tell the user to connect in Settings → Connections
  ✓  If asked about profile info (name, email, LinkedIn, etc.), answer from the User Profile above`;
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

  const { messages, sessionId: incomingSessionId } = parsed.data;

  // Extract the last user message text
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

  // Create a session lazily — only on first message (when no sessionId passed)
  const sessionId = incomingSessionId ?? (await createSession("email"));

  const [systemPrompt, modelMessages] = await Promise.all([
    buildEmailSystemPrompt(),
    convertToModelMessages(messages as UIMessage[]),
  ]);

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const result = streamText({
        model: chatModel,
        system: systemPrompt,
        messages: modelMessages,
        tools: { ...emailTools, save_email_attachments: vaultAttachmentTool },
        stopWhen: stepCountIs(5),
        temperature: 0.3,
        onFinish: async ({ text }) => {
          try {
            await remember(sessionId, userText, text);
          } catch {
            // Non-fatal — memory pipeline failure never blocks the user
          }
        },
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Session-Id": sessionId },
  });
}

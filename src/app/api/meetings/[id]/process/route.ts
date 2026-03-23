import { generateObject } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { extractionModel } from "@/agent/ollama";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { createTask } from "@/planner/tasks";
import { embedAndStore } from "@/memory/semantic";
import { processExtractedEntities } from "@/memory/entity";
import { extractEntitiesFromConversation } from "@/agent/extract";

// ── Extraction schema ────────────────────────────────────────────────────────

const MeetingExtractionSchema = z.object({
  summary: z.string().describe(
    "2-3 paragraph summary of the meeting covering main topics, outcomes, and next steps"
  ),
  actionItems: z.array(z.object({
    task: z.string().describe("The specific action item or task to be completed"),
    assignee: z.string().optional().describe("Name of person responsible (omit if unclear)"),
    dueDate: z.string().optional().describe("Due date in ISO 8601 format if mentioned, otherwise omit"),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
  })).describe("All action items, tasks, and follow-ups discussed"),
  decisions: z.array(z.string()).describe(
    "Key decisions made during the meeting (be specific and factual)"
  ),
  participants: z.array(z.string()).describe(
    "Full names or identifiers of all meeting participants"
  ),
  topics: z.array(z.string()).describe("Main topics and agenda items covered"),
});

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Load meeting
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
  if (!meeting) return Response.json({ error: "Meeting not found" }, { status: 404 });
  if (!meeting.transcript?.trim()) {
    return Response.json({ error: "No transcript to process" }, { status: 400 });
  }

  // Truncate transcript to avoid exceeding context window (~8k tokens safe limit for qwen3:8b)
  const transcriptForAI = meeting.transcript.slice(0, 16000);

  // ── Step 1: Extract structured data from transcript ──────────────────────
  let extracted: z.infer<typeof MeetingExtractionSchema>;
  try {
    const result = await generateObject({
      model: extractionModel,
      schema: MeetingExtractionSchema,
      prompt: `You are analyzing a meeting transcript. Extract all key information accurately.

MEETING TRANSCRIPT:
${transcriptForAI}

${meeting.title !== "Untitled Meeting" ? `Meeting title: ${meeting.title}` : ""}
${meeting.participants?.length ? `Known participants: ${meeting.participants.join(", ")}` : ""}

Extract:
- A comprehensive summary
- Every action item and task mentioned
- All decisions made
- Names of participants
- Main topics discussed`,
      temperature: 0,
    });
    extracted = result.object;
  } catch (err) {
    return Response.json(
      { error: `AI extraction failed: ${String(err)}` },
      { status: 500 }
    );
  }

  // ── Step 2: Create tasks from action items ────────────────────────────────
  let tasksCreated = 0;
  for (const item of extracted.actionItems) {
    try {
      let dueDate: Date | undefined;
      if (item.dueDate) {
        const d = new Date(item.dueDate);
        if (!isNaN(d.getTime())) dueDate = d;
      }
      await createTask({
        title: item.task,
        description: item.assignee ? `Assignee: ${item.assignee}` : undefined,
        priority: item.priority as "high" | "medium" | "low",
        dueDate,
        tags: ["meeting", meeting.title.toLowerCase().replace(/\s+/g, "-").slice(0, 40)],
      });
      tasksCreated++;
    } catch (err) {
      console.error("[meetings/process] failed to create task:", item.task, err);
    }
  }

  // ── Step 3: Update participants if extracted more names ────────────────────
  const allParticipants = Array.from(new Set([
    ...(meeting.participants ?? []),
    ...extracted.participants,
  ])).filter(Boolean);

  // ── Step 4: Save to memory pipeline (async, non-blocking) ────────────────
  const meetingMemoryText = [
    `Meeting: ${meeting.title}`,
    `Date: ${new Date(meeting.createdAt).toLocaleDateString()}`,
    `Participants: ${allParticipants.join(", ")}`,
    `Summary: ${extracted.summary}`,
    `Decisions: ${extracted.decisions.join("; ")}`,
    `Action items: ${extracted.actionItems.map((a) => a.task).join("; ")}`,
  ].join("\n");

  // Embed meeting summary into semantic memory
  void embedAndStore(meetingMemoryText, "meeting", id).catch(() => {});

  // Extract entities from the transcript for the knowledge graph.
  // Pass transcript as user message and summary as assistant message.
  void extractEntitiesFromConversation(meeting.transcript, extracted.summary)
    .then((extraction) => {
      if (extraction) return processExtractedEntities(extraction);
    })
    .catch(() => {});

  // ── Step 5: Persist processed data to DB ─────────────────────────────────
  try {
    const [updated] = await db
      .update(meetings)
      .set({
        summary: extracted.summary,
        actionItems: extracted.actionItems,
        decisions: extracted.decisions,
        topics: extracted.topics,
        participants: allParticipants,
        tasksCreated,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(meetings.id, id))
      .returning();

    return Response.json({
      meeting: updated,
      tasksCreated,
      entitiesQueued: true,
    });
  } catch (err) {
    console.error("[meetings/process] DB update failed:", err);
    return Response.json(
      { error: "Processing completed but failed to save results", tasksCreated },
      { status: 500 },
    );
  }
}

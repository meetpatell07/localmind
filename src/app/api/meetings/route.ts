import { db } from "@/db";
import { meetings } from "@/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(meetings)
      .orderBy(desc(meetings.createdAt))
      .limit(50);
    return Response.json({ meetings: rows });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

const CreateMeetingSchema = z.object({
  title: z.string().min(1).max(500).default("Untitled Meeting"),
  transcript: z.string().default(""),
  participants: z.array(z.string()).default([]),
  durationSeconds: z.number().int().nonnegative().nullish(),
  source: z.enum(["recorded", "pasted"]).default("recorded"),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, transcript, participants, durationSeconds, source } = parsed.data;

  try {
    const [meeting] = await db.insert(meetings).values({
      title,
      transcript,
      participants,
      durationSeconds: durationSeconds ?? null,
      source,
    }).returning();

    return Response.json({ meeting }, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

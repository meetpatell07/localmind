import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    if (!meeting) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ meeting });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

const PatchMeetingSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  participants: z.array(z.string()).optional(),
  transcript: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchMeetingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [meeting] = await db
      .update(meetings)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    if (!meeting) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ meeting });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.delete(meetings).where(eq(meetings.id, id));
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

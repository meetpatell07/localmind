import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionList, createSession, deleteSession } from "@/memory/episodic";

export async function GET() {
  try {
    const sessions = await getSessionList(50);
    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const sessionId = await createSession("chat");
    return NextResponse.json({ sessionId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = z.object({ sessionId: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid sessionId (UUID) required" }, { status: 400 });
  }

  try {
    await deleteSession(parsed.data.sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

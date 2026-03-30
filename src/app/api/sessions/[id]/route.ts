export const runtime = 'edge';
import { NextResponse } from "next/server";
import { getRecentMessages } from "@/memory/episodic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await getRecentMessages(id, 100);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export const runtime = 'edge';
import { NextResponse } from "next/server";
import { forkSession } from "@/memory/episodic";
import { z } from "zod";

const ForkSchema = z.object({
  sourceSessionId: z.string().uuid(),
  upToIndex: z.number().int().min(0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = ForkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await forkSession(parsed.data.sourceSessionId, parsed.data.upToIndex);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

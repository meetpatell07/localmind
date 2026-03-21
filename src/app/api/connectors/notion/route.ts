import { NextResponse } from "next/server";
import { z } from "zod";
import {
  saveNotionToken,
  disconnectNotion,
  getNotionConnectionStatus,
} from "@/connectors/notion-mcp";

const TokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

/** POST — save Notion integration token */
export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid token", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await saveNotionToken(parsed.data.token);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notion/route] save error:", err);
    return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
  }
}

/** GET — check Notion connection status */
export async function GET(): Promise<Response> {
  const status = await getNotionConnectionStatus();
  return NextResponse.json(status);
}

/** DELETE — disconnect Notion */
export async function DELETE(): Promise<Response> {
  try {
    await disconnectNotion();
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getGoogleConnectionStatus, disconnectGoogle } from "@/connectors/google-auth";
import { getNotionConnectionStatus, disconnectNotion } from "@/connectors/notion-mcp";

export async function GET(): Promise<Response> {
  try {
    const [google, notion] = await Promise.all([
      getGoogleConnectionStatus(),
      getNotionConnectionStatus(),
    ]);

    const calendar = google.connected; // shares Google OAuth

    return NextResponse.json({
      connectors: {
        google: {
          ...google,
          services: google.connected ? ["gmail", "calendar", "drive"] : [],
        },
        notion,
        calendar,
      },
    });
  } catch (err) {
    console.error("[connectors/status]", err);
    return NextResponse.json({ connectors: {} }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  if (provider === "google") {
    try {
      await disconnectGoogle();
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (provider === "notion") {
    try {
      await disconnectNotion();
      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
}

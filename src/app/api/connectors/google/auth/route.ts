export const runtime = 'nodejs';
import { getAuthUrl } from "@/connectors/google-auth";
import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local" },
      { status: 503 }
    );
  }

  try {
    const url = await getAuthUrl();
    if (!url) return NextResponse.json({ error: "Google Auth unavailable on this runtime" }, { status: 503 });
    return NextResponse.redirect(url);
  } catch (err) {
    console.error("[google/auth]", err);
    return NextResponse.json(
      { error: "Failed to generate Google OAuth URL" },
      { status: 500 }
    );
  }
}

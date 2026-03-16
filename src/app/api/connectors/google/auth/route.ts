import { getAuthUrl } from "@/connectors/google-auth";
import { NextResponse } from "next/server";

export async function GET(): Promise<Response> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.local" },
      { status: 503 }
    );
  }

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}

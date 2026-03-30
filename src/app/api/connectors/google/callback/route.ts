export const runtime = 'nodejs';
import { NextResponse } from "next/server";
import { exchangeCodeForTokens, saveGoogleTokens } from "@/connectors/google-auth";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}/settings?error=missing_code`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) return NextResponse.redirect(`${base}/settings?error=google_unavailable`);
    await saveGoogleTokens(tokens);
    return NextResponse.redirect(`${base}/settings?connected=google`);
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(
      `${base}/settings?error=${encodeURIComponent("token_exchange_failed")}`
    );
  }
}

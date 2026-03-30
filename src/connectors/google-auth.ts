/**
 * Google OAuth2 helper — manages the full token lifecycle for Gmail + Calendar + Drive.
 *
 * Tokens are stored in the `settings` table under:
 *   key = "connector:google:tokens"
 *   value = { access_token, refresh_token, expiry_date, scope }
 *
 * The connector row in `connectors` table tracks connection status.
 *
 * googleapis and google-auth-library are dynamically imported so this module
 * can be imported in edge-runtime route files. At runtime on Cloudflare edge,
 * the dynamic import will fail and functions return null/throw — callers handle
 * this gracefully.
 */

import { db } from "@/db";
import { settings, connectors } from "@/db/schema";
import { eq } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OAuth2Client = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Credentials = any;

// ── Scopes ────────────────────────────────────────────────────────────────────
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const TOKENS_KEY = "connector:google:tokens";

// ── Dynamic googleapis loader ────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGoogle(): Promise<any | null> {
  try {
    const mod = await import("googleapis");
    return mod.google;
  } catch {
    return null;
  }
}

// ── OAuth2 client factory ─────────────────────────────────────────────────────
export async function createOAuth2Client(): Promise<OAuth2Client | null> {
  const google = await getGoogle();
  if (!google) return null;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/connectors/google/callback`
  );
}

// ── Generate consent URL ──────────────────────────────────────────────────────
export async function getAuthUrl(): Promise<string | null> {
  const client = await createOAuth2Client();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent",
  });
}

// ── Exchange code for tokens ──────────────────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<Credentials | null> {
  const client = await createOAuth2Client();
  if (!client) return null;
  const { tokens } = await client.getToken(code);
  return tokens;
}

// ── Persist tokens ────────────────────────────────────────────────────────────
export async function saveGoogleTokens(tokens: Credentials): Promise<void> {
  await db
    .insert(settings)
    .values({ key: TOKENS_KEY, value: tokens as Record<string, unknown> })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: tokens as Record<string, unknown>, updatedAt: new Date() },
    });

  const existing = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(eq(connectors.provider, "google"))
    .limit(1);

  const now = new Date();
  if (existing[0]) {
    await db
      .update(connectors)
      .set({ isActive: true, scopes: GOOGLE_SCOPES, connectedAt: now, syncStatus: "idle", errorMessage: null })
      .where(eq(connectors.provider, "google"));
  } else {
    await db.insert(connectors).values({
      provider: "google",
      isActive: true,
      scopes: GOOGLE_SCOPES,
      connectedAt: now,
      syncStatus: "idle",
    });
  }
}

// ── Load tokens ───────────────────────────────────────────────────────────────
export async function loadGoogleTokens(): Promise<Credentials | null> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, TOKENS_KEY))
    .limit(1);
  return (rows[0]?.value as Credentials) ?? null;
}

// ── Get an authenticated OAuth2 client (auto-refreshes) ──────────────────────
export async function getAuthenticatedClient(): Promise<OAuth2Client | null> {
  const tokens = await loadGoogleTokens();
  if (!tokens?.refresh_token) return null;

  const client = await createOAuth2Client();
  if (!client) return null;
  client.setCredentials(tokens);

  client.on("tokens", async (newTokens: Credentials) => {
    const merged = { ...tokens, ...newTokens };
    await saveGoogleTokens(merged).catch(() => {});
  });

  return client;
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectGoogle(): Promise<void> {
  const tokens = await loadGoogleTokens();
  if (tokens?.access_token) {
    const client = await createOAuth2Client();
    if (client) {
      client.setCredentials(tokens);
      await client.revokeCredentials().catch(() => {});
    }
  }
  await db.delete(settings).where(eq(settings.key, TOKENS_KEY));
  await db
    .update(connectors)
    .set({ isActive: false, syncStatus: "idle", errorMessage: null })
    .where(eq(connectors.provider, "google"));
}

// ── Status check ──────────────────────────────────────────────────────────────
export async function getGoogleConnectionStatus(): Promise<{
  connected: boolean;
  email?: string;
  scopes?: string[];
  connectedAt?: Date | null;
  lastSyncAt?: Date | null;
  syncStatus?: string | null;
}> {
  const row = await db
    .select()
    .from(connectors)
    .where(eq(connectors.provider, "google"))
    .limit(1);

  if (!row[0]?.isActive) return { connected: false };

  try {
    const client = await getAuthenticatedClient();
    if (!client) return { connected: false };

    const google = await getGoogle();
    if (!google) return { connected: false };

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const userInfo = await oauth2.userinfo.get();

    return {
      connected: true,
      email: userInfo.data.email ?? undefined,
      scopes: row[0].scopes as string[],
      connectedAt: row[0].connectedAt,
      lastSyncAt: row[0].lastSyncAt,
      syncStatus: row[0].syncStatus,
    };
  } catch {
    return { connected: false };
  }
}

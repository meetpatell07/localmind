/**
 * Google OAuth2 helper — manages the full token lifecycle for Gmail + Calendar.
 *
 * Tokens are stored in the `settings` table under:
 *   key = "connector:google:tokens"
 *   value = { access_token, refresh_token, expiry_date, scope }
 *
 * The connector row in `connectors` table tracks connection status.
 */

import { google } from "googleapis";
import type { OAuth2Client, Credentials } from "google-auth-library";
import { db } from "@/db";
import { settings, connectors } from "@/db/schema";
import { eq } from "drizzle-orm";

// ── Scopes ────────────────────────────────────────────────────────────────────
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const TOKENS_KEY = "connector:google:tokens";

// ── OAuth2 client factory ─────────────────────────────────────────────────────
export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"}/api/connectors/google/callback`
  );
}

// ── Generate consent URL ──────────────────────────────────────────────────────
export function getAuthUrl(): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent", // always get refresh_token
  });
}

// ── Exchange code for tokens ──────────────────────────────────────────────────
export async function exchangeCodeForTokens(code: string): Promise<Credentials> {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// ── Persist tokens ────────────────────────────────────────────────────────────
export async function saveGoogleTokens(tokens: Credentials): Promise<void> {
  await db
    .insert(settings)
    .values({
      key: TOKENS_KEY,
      value: tokens as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: tokens as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  // Upsert connector row
  const existing = await db
    .select({ id: connectors.id })
    .from(connectors)
    .where(eq(connectors.provider, "google"))
    .limit(1);

  const now = new Date();

  if (existing[0]) {
    await db
      .update(connectors)
      .set({
        isActive: true,
        scopes: GOOGLE_SCOPES,
        connectedAt: now,
        syncStatus: "idle",
        errorMessage: null,
      })
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

  const client = createOAuth2Client();
  client.setCredentials(tokens);

  // googleapis auto-refreshes when access_token is expired using refresh_token
  // Persist refreshed tokens if they changed
  client.on("tokens", async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await saveGoogleTokens(merged).catch(() => {});
  });

  return client;
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectGoogle(): Promise<void> {
  // Revoke token at Google
  const tokens = await loadGoogleTokens();
  if (tokens?.access_token) {
    const client = createOAuth2Client();
    client.setCredentials(tokens);
    await client.revokeCredentials().catch(() => {});
  }

  // Remove from settings
  await db.delete(settings).where(eq(settings.key, TOKENS_KEY));

  // Mark connector as inactive
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

  // Try to get user info to verify token is valid
  try {
    const client = await getAuthenticatedClient();
    if (!client) return { connected: false };

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
    return {
      connected: false,
    };
  }
}

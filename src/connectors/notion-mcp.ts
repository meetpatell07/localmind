/**
 * Notion MCP Client — connects to @notionhq/notion-mcp-server via stdio.
 *
 * Spawns the Notion MCP server as a child process, passing the user's
 * Internal Integration Token. Exposes tools that can be merged into
 * streamText() calls alongside existing tools.
 *
 * Lifecycle: lazy-init on first use, cached for reuse, close on disconnect.
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport as StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { db } from "@/db";
import { settings, connectors } from "@/db/schema";
import { eq } from "drizzle-orm";

let mcpClient: MCPClient | null = null;

/** Load the Notion token from the settings table. */
export async function loadNotionToken(): Promise<string | null> {
  const rows = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "connector:notion:token"))
    .limit(1);
  if (!rows[0]) return null;
  const val = rows[0].value as { token?: string };
  return val.token ?? null;
}

/** Save a Notion Integration Token + upsert connector row. */
export async function saveNotionToken(token: string): Promise<void> {
  await db
    .insert(settings)
    .values({
      key: "connector:notion:token",
      value: { token },
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { token }, updatedAt: new Date() },
    });

  await db
    .insert(connectors)
    .values({
      provider: "notion",
      isActive: true,
      connectedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: connectors.provider,
      set: { isActive: true, connectedAt: new Date() },
    });
}

/** Remove the Notion token and mark connector inactive. */
export async function disconnectNotion(): Promise<void> {
  await closeMCPClient();
  await db.delete(settings).where(eq(settings.key, "connector:notion:token"));
  await db
    .update(connectors)
    .set({ isActive: false })
    .where(eq(connectors.provider, "notion"));
}

/** Get the Notion connection status. */
export async function getNotionConnectionStatus(): Promise<{
  connected: boolean;
  connectedAt?: string | null;
}> {
  const token = await loadNotionToken();
  if (!token) return { connected: false };

  const rows = await db
    .select({ connectedAt: connectors.connectedAt })
    .from(connectors)
    .where(eq(connectors.provider, "notion"))
    .limit(1);

  return {
    connected: true,
    connectedAt: rows[0]?.connectedAt?.toISOString() ?? null,
  };
}

/** Get or create the MCP client. Returns null if no token is configured. */
async function getMCPClient(): Promise<MCPClient | null> {
  if (mcpClient) return mcpClient;

  const token = await loadNotionToken();
  if (!token) return null;

  const transport = new StdioMCPTransport({
    command: "npx",
    args: ["-y", "@notionhq/notion-mcp-server"],
    env: {
      ...process.env as Record<string, string>,
      OPENAPI_MCP_HEADERS: JSON.stringify({
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
      }),
    },
  });

  // Reset cached client if the transport closes unexpectedly
  transport.onclose = () => {
    console.warn("[notion-mcp] transport closed unexpectedly, resetting client");
    mcpClient = null;
  };

  try {
    mcpClient = await createMCPClient({
      transport,
      name: "localmind-notion",
      onUncaughtError: (err) => {
        console.error("[notion-mcp] uncaught error:", err);
        mcpClient = null;
      },
    });
  } catch (err) {
    console.error("[notion-mcp] failed to create client:", err);
    return null;
  }

  return mcpClient;
}

/** Close the MCP client and reset state. */
async function closeMCPClient(): Promise<void> {
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch {
      // ignore close errors
    }
    mcpClient = null;
  }
}

const NOTION_KEYWORDS = /\bnotion\b/i;

/** Check if user text mentions Notion-related concepts. */
export function shouldUseNotionTools(userText: string): boolean {
  return NOTION_KEYWORDS.test(userText);
}

/**
 * Get Notion tools for use in streamText().
 * Returns an empty object if Notion is not connected.
 * Call shouldUseNotionTools() first to avoid spawning the MCP server unnecessarily.
 */
export async function getNotionTools(): Promise<Record<string, unknown>> {
  try {
    const client = await getMCPClient();
    if (!client) return {};
    const tools = await client.tools();
    return tools as Record<string, unknown>;
  } catch (err) {
    console.error("[notion-mcp] failed to get tools:", err);
    // Reset client on error so next call tries fresh
    mcpClient = null;
    return {};
  }
}

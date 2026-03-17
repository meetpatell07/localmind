/**
 * Telegram Webhook Setup — GET /api/telegram/setup
 *
 * Registers (or removes) the webhook URL with Telegram.
 *
 * Usage:
 *   Register:  GET /api/telegram/setup
 *   With URL:  GET /api/telegram/setup?url=https://your-domain.com
 *   Delete:    GET /api/telegram/setup?action=delete
 *   Status:    GET /api/telegram/setup?action=info
 *
 * In production set NEXT_PUBLIC_BASE_URL to your public domain.
 * For local dev use ngrok: ngrok http 3000
 */

import { setWebhook, deleteWebhook, getWebhookInfo } from "@/connectors/telegram";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "set";

  if (action === "delete") {
    const result = await deleteWebhook();
    return Response.json({ action: "deleted", result });
  }

  if (action === "info") {
    const result = await getWebhookInfo();
    return Response.json({ action: "info", result });
  }

  // Determine webhook URL
  const baseUrl =
    searchParams.get("url") ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    "http://localhost:3000";

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const result = await setWebhook(webhookUrl, secret);

  return Response.json({
    action: "set",
    webhookUrl,
    secret: secret ? "set" : "not set (requests will not be verified)",
    result,
  });
}

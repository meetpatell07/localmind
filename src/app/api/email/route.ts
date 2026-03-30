export const runtime = 'edge';
import { getAuthenticatedClient } from "@/connectors/google-auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGoogle(): Promise<any | null> {
  try { const m = await import("googleapis"); return m.google; } catch { return null; }
}

function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const maxResults = Math.min(parseInt(searchParams.get("max") ?? "20", 10), 50);
  const labelIds = searchParams.get("label") === "unread" ? ["UNREAD"] : ["INBOX"];

  const auth = await getAuthenticatedClient();
  if (!auth) {
    return Response.json({ error: "Gmail not connected", connected: false }, { status: 200 });
  }
  const google = await getGoogle();
  if (!google) return Response.json({ error: "Gmail unavailable on this runtime", connected: false }, { status: 200 });

  try {
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      labelIds,
    });

    if (!listRes.data.messages?.length) {
      return Response.json({ emails: [], total: 0, connected: true });
    }

    const emails = await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      listRes.data.messages.map(async (msg: any) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });
        const h = detail.data.payload?.headers;
        return {
          id: msg.id!,
          from: getHeader(h, "From"),
          subject: getHeader(h, "Subject"),
          date: getHeader(h, "Date"),
          snippet: detail.data.snippet ?? "",
          isUnread: detail.data.labelIds?.includes("UNREAD") ?? false,
        };
      })
    );

    return Response.json({ emails, total: emails.length, connected: true });
  } catch (err) {
    return Response.json({ error: String(err), connected: true }, { status: 500 });
  }
}

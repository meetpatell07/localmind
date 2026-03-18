import { NextResponse } from "next/server";
import { listDriveFiles, searchDriveFiles } from "@/connectors/google-drive";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q") ?? "";
  const starred = searchParams.get("starred") === "true";
  const max     = Math.min(Number(searchParams.get("max") ?? "20") || 20, 50);

  try {
    if (q.trim()) {
      const result = await searchDriveFiles(q.trim(), max);
      if (result.error) {
        return NextResponse.json({ error: result.error, connected: false }, { status: 503 });
      }
      return NextResponse.json({ files: result.files, connected: true });
    }

    const result = await listDriveFiles({ maxResults: max, starred: starred || undefined });
    if (result.error) {
      return NextResponse.json({ error: result.error, connected: false }, { status: 503 });
    }
    return NextResponse.json({ files: result.files, connected: true });
  } catch (err) {
    console.error("[api/drive]", err);
    return NextResponse.json({ error: String(err), connected: false }, { status: 500 });
  }
}

export const runtime = 'edge';
import { NextResponse } from "next/server";
import { getDriveFileContent } from "@/connectors/google-drive";

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing file id parameter" }, { status: 400 });
  }

  try {
    const result = await getDriveFileContent(id);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/drive/file]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

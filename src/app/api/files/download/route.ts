export const runtime = 'edge';
import { NextRequest } from "next/server";
import { db } from "@/db";
import { vaultFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVaultPath } from "@/vault/indexer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNodeModules(): Promise<{ path: any; fs: any } | null> {
  try {
    const [p, f] = await Promise.all([import("path"), import("fs/promises")]);
    return { path: p.default, fs: f };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing file id" }, { status: 400 });
  }

  const rows = await db
    .select({ fileName: vaultFiles.fileName, filePath: vaultFiles.filePath, mimeType: vaultFiles.mimeType })
    .from(vaultFiles)
    .where(eq(vaultFiles.id, id))
    .limit(1);

  if (!rows[0]) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const mods = await getNodeModules();
  if (!mods) return Response.json({ error: "File download unavailable on this runtime" }, { status: 503 });

  const { fileName, filePath, mimeType } = rows[0];
  const fullPath = getVaultPath(filePath);

  // Path traversal protection
  const vaultDir = getVaultPath("");
  const resolved = mods.path.resolve(fullPath);
  if (!resolved.startsWith(mods.path.resolve(vaultDir))) {
    return Response.json({ error: "Invalid file path" }, { status: 403 });
  }

  let data: Uint8Array;
  try {
    data = await mods.fs.readFile(fullPath);
  } catch {
    return Response.json({ error: "File missing from disk" }, { status: 404 });
  }

  return new Response(data.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(data.length),
    },
  });
}

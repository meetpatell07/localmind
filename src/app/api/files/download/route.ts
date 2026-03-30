export const runtime = 'edge';
import { NextRequest } from "next/server";
import { db } from "@/db";
import { vaultFiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVaultPath } from "@/vault/indexer";
import path from "path";
import fs from "fs/promises";

const VAULT_DIR = path.join(process.cwd(), "vault");

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing file id" }, { status: 400 });
  }

  const rows = await db
    .select({
      fileName: vaultFiles.fileName,
      filePath: vaultFiles.filePath,
      mimeType: vaultFiles.mimeType,
    })
    .from(vaultFiles)
    .where(eq(vaultFiles.id, id))
    .limit(1);

  if (!rows[0]) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const { fileName, filePath, mimeType } = rows[0];
  const fullPath = getVaultPath(filePath);

  // Path traversal protection — ensure resolved path stays inside vault
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(VAULT_DIR))) {
    return Response.json({ error: "Invalid file path" }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(fullPath);
  } catch {
    return Response.json({ error: "File missing from disk" }, { status: 404 });
  }

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(buffer.length),
    },
  });
}

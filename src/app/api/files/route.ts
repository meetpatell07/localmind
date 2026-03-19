import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import { ensureVaultDir, indexFile, listFiles, getVaultPath, getFilesByCategory, updateFileAnalysis } from "@/vault/indexer";
import { analyzeFile } from "@/vault/analyzer";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const view = req.nextUrl.searchParams.get("view");

  if (view === "canvas") {
    const grouped = await getFilesByCategory();
    return Response.json({ grouped });
  }

  const files = await listFiles(q);
  return Response.json({ files });
}

export async function POST(req: NextRequest) {
  await ensureVaultDir();

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  // Organize into YYYY/MM/DD
  const now = new Date();
  const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const fullDir = getVaultPath(subDir);
  await fs.mkdir(fullDir, { recursive: true });

  // Avoid collisions
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;
  const relativePath = path.join(subDir, uniqueName);
  const fullPath = getVaultPath(relativePath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buffer);

  const record = await indexFile({
    fileName: file.name,
    relativePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: buffer.length,
    source: "web",
  });

  // Fire-and-forget AI analysis — never blocks the upload response
  analyzeFile({
    fileId: record.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    absolutePath: fullPath,
  })
    .then((analysis) => updateFileAnalysis(record.id, analysis))
    .catch(() => {});

  return Response.json({ file: record }, { status: 201 });
}

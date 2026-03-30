export const runtime = 'edge';
import { NextRequest } from "next/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNodeModules(): Promise<{ path: any; fs: any } | null> {
  try {
    const [p, f] = await Promise.all([import("path"), import("fs/promises")]);
    return { path: p.default, fs: f };
  } catch { return null; }
}
import { ensureVaultDir, indexFile, listFiles, getVaultPath, getFilesByCategory, updateFileAnalysis, deleteFile } from "@/vault/indexer";
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

  const mods = await getNodeModules();
  if (!mods) return Response.json({ error: "File upload unavailable on this runtime" }, { status: 503 });

  // Organize into YYYY/MM/DD
  const now = new Date();
  const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const fullDir = getVaultPath(subDir);
  await mods.fs.mkdir(fullDir, { recursive: true });

  // Avoid collisions
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;
  const relativePath = mods.path.join(subDir, uniqueName);
  const fullPath = getVaultPath(relativePath);

  const arrayBuf = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuf);
  await mods.fs.writeFile(fullPath, buffer);

  const record = await indexFile({
    fileName: file.name,
    relativePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: arrayBuf.byteLength,
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

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing file id" }, { status: 400 });
  }

  const deleted = await deleteFile(id);
  if (!deleted) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}

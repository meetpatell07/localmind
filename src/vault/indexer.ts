import { db } from "@/db";
import { vaultFiles } from "@/db/schema";
import { desc, ilike, eq, sql } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";

const VAULT_DIR = path.join(process.cwd(), "vault");

export async function ensureVaultDir(): Promise<void> {
  await fs.mkdir(VAULT_DIR, { recursive: true });
}

export function getVaultPath(relativePath: string): string {
  return path.join(VAULT_DIR, relativePath);
}

export async function indexFile(params: {
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  tags?: string[];
  source?: string;
  telegramFileId?: string;
}) {
  const [file] = await db
    .insert(vaultFiles)
    .values({
      fileName: params.fileName,
      filePath: params.relativePath,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      tags: params.tags ?? [],
      source: params.source ?? "web",
      telegramFileId: params.telegramFileId,
    })
    .returning({ id: vaultFiles.id });
  return file;
}

export async function listFiles(q?: string) {
  if (q) {
    return db
      .select()
      .from(vaultFiles)
      .where(ilike(vaultFiles.fileName, `%${q}%`))
      .orderBy(desc(vaultFiles.createdAt))
      .limit(100);
  }
  return db
    .select()
    .from(vaultFiles)
    .orderBy(desc(vaultFiles.createdAt))
    .limit(100);
}

export async function getVaultPath_fromId(id: string): Promise<string | null> {
  const rows = await db
    .select({ filePath: vaultFiles.filePath })
    .from(vaultFiles)
    .where(eq(vaultFiles.id, id))
    .limit(1);
  return rows[0] ? getVaultPath(rows[0].filePath) : null;
}

export async function getFilesByCategory() {
  const rows = await db
    .select({
      category: vaultFiles.category,
      id: vaultFiles.id,
      fileName: vaultFiles.fileName,
      mimeType: vaultFiles.mimeType,
      sizeBytes: vaultFiles.sizeBytes,
      createdAt: vaultFiles.createdAt,
      tags: vaultFiles.tags,
    })
    .from(vaultFiles)
    .orderBy(desc(vaultFiles.createdAt))
    .limit(200);

  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    const cat = row.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(row);
  }
  return grouped;
}

export async function updateFileAnalysis(
  id: string,
  updates: { category?: string; summary?: string; tags?: string[]; isIndexed?: boolean }
) {
  await db.update(vaultFiles).set(updates).where(eq(vaultFiles.id, id));
}

export async function deleteFile(fileId: string): Promise<boolean> {
  const rows = await db
    .select({ filePath: vaultFiles.filePath })
    .from(vaultFiles)
    .where(eq(vaultFiles.id, fileId))
    .limit(1);

  if (!rows[0]) return false;

  await db.delete(vaultFiles).where(eq(vaultFiles.id, fileId));

  try {
    const fullPath = getVaultPath(rows[0].filePath);
    await fs.unlink(fullPath);
  } catch {
    // File already deleted or path invalid
  }

  return true;
}

export async function emailAttachmentExists(fileName: string, sizeBytes: number): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(
      sql`${vaultFiles.fileName} = ${fileName} AND ${vaultFiles.sizeBytes} = ${sizeBytes} AND ${vaultFiles.source} = 'email'`
    )
    .limit(1);
  return rows.length > 0;
}

export async function emailFileNameExists(fileName: string): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(sql`${vaultFiles.fileName} = ${fileName} AND ${vaultFiles.source} = 'email'`)
    .limit(1);
  return rows.length > 0;
}

export async function fileExistsByTelegramId(telegramFileId: string): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(eq(vaultFiles.telegramFileId, telegramFileId))
    .limit(1);
  return rows.length > 0;
}

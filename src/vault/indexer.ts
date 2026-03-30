import { db } from "@/db";
import { vaultFiles } from "@/db/schema";
import { desc, ilike, eq, sql } from "drizzle-orm";
// Lazy vault directory resolver — safe to import on edge (no module-level side-effects)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getNodeModules(): Promise<{ path: any; fs: any } | null> {
  try {
    const [pathMod, fsMod] = await Promise.all([import("path"), import("fs/promises")]);
    return { path: pathMod.default, fs: fsMod };
  } catch {
    return null;
  }
}

function resolveVaultDir(): string {
  // process.cwd() throws on CF edge — catch and return a placeholder
  try { return `${process.cwd()}/vault`; } catch { return "/vault"; }
}

export async function ensureVaultDir(): Promise<void> {
  const mods = await getNodeModules();
  if (!mods) return;
  const dir = resolveVaultDir();
  await mods.fs.mkdir(dir, { recursive: true });
}

export function getVaultPath(relativePath: string): string {
  // Synchronous best-effort — works on Node.js, returns placeholder on edge
  try {
    return `${resolveVaultDir()}/${relativePath.replace(/\\/g, "/")}`;
  } catch {
    return `/vault/${relativePath}`;
  }
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
    .returning();
  return file;
}

export async function updateFileAnalysis(
  fileId: string,
  analysis: { category: string; summary: string; tags: string[] }
): Promise<void> {
  await db
    .update(vaultFiles)
    .set({ category: analysis.category, summary: analysis.summary, tags: analysis.tags, isIndexed: true })
    .where(eq(vaultFiles.id, fileId));
}

/** Delete a vault file from both the database and physical disk. */
export async function deleteFile(fileId: string): Promise<boolean> {
  const rows = await db
    .select({ filePath: vaultFiles.filePath })
    .from(vaultFiles)
    .where(eq(vaultFiles.id, fileId))
    .limit(1);

  if (!rows[0]) return false;

  // Remove from DB first
  await db.delete(vaultFiles).where(eq(vaultFiles.id, fileId));

  // Remove physical file — best-effort (may already be gone)
  try {
    const mods = await getNodeModules();
    if (mods) {
      const fullPath = getVaultPath(rows[0].filePath);
      await mods.fs.unlink(fullPath);
    }
  } catch {
    // File already deleted or path invalid — not an error
  }

  return true;
}

export async function listFiles(search?: string) {
  if (search) {
    return db
      .select()
      .from(vaultFiles)
      .where(ilike(vaultFiles.fileName, `%${search}%`))
      .orderBy(desc(vaultFiles.createdAt))
      .limit(100);
  }
  return db
    .select()
    .from(vaultFiles)
    .orderBy(desc(vaultFiles.createdAt))
    .limit(100);
}

export async function getFilesByCategory(): Promise<
  Record<string, (typeof vaultFiles.$inferSelect)[]>
> {
  const rows = await db
    .select()
    .from(vaultFiles)
    .orderBy(desc(vaultFiles.createdAt))
    .limit(200);

  const grouped: Record<string, (typeof vaultFiles.$inferSelect)[]> = {};
  for (const row of rows) {
    const cat = row.category ?? "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(row);
  }
  return grouped;
}

export async function getCategorySummary(): Promise<Array<{ category: string; count: number }>> {
  const rows = await db
    .select({
      category: vaultFiles.category,
      count: sql<number>`count(*)::int`,
    })
    .from(vaultFiles)
    .groupBy(vaultFiles.category)
    .orderBy(desc(sql`count(*)`));

  return rows.map((r) => ({ category: r.category ?? "Other", count: r.count }));
}

export async function fileExistsByTelegramId(telegramFileId: string): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(eq(vaultFiles.telegramFileId, telegramFileId))
    .limit(1);
  return rows.length > 0;
}

/** Check if an email attachment already exists in vault (same name, source, and size). */
export async function emailAttachmentExists(
  fileName: string,
  sizeBytes: number
): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(
      sql`${vaultFiles.fileName} = ${fileName}
        AND ${vaultFiles.source} = 'email'
        AND ${vaultFiles.sizeBytes} = ${sizeBytes}`
    )
    .limit(1);
  return rows.length > 0;
}

/** Check if any email attachment with this filename exists in vault (for reporting). */
export async function emailFileNameExists(fileName: string): Promise<boolean> {
  const rows = await db
    .select({ id: vaultFiles.id })
    .from(vaultFiles)
    .where(
      sql`${vaultFiles.fileName} = ${fileName}
        AND ${vaultFiles.source} = 'email'`
    )
    .limit(1);
  return rows.length > 0;
}

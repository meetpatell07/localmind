/**
 * Google Drive API helper — list, search, and read Drive files.
 * Uses the authenticated OAuth2 client from google-auth.ts.
 * All calls are read-only (drive.readonly scope).
 */

import { google } from "googleapis";
import { getAuthenticatedClient } from "./google-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  starred: boolean;
  iconLink: string | null;
}

// ── MIME type formatting ───────────────────────────────────────────────────────

export function formatDriveMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "application/vnd.google-apps.document":     "Google Doc",
    "application/vnd.google-apps.spreadsheet":  "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder":       "Folder",
    "application/vnd.google-apps.form":         "Google Form",
    "application/pdf":                          "PDF",
    "text/plain":                               "Text",
    "image/jpeg":                               "JPEG Image",
    "image/png":                                "PNG Image",
  };
  return map[mimeType] ?? mimeType.split("/").pop() ?? mimeType;
}

// ── List files ────────────────────────────────────────────────────────────────

export async function listDriveFiles(opts: {
  maxResults?: number;
  mimeType?: string;
  starred?: boolean;
  folderId?: string;
}): Promise<{ files: DriveFile[]; error?: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { files: [], error: "Google Drive not connected." };

  try {
    const drive = google.drive({ version: "v3", auth });

    const queryParts: string[] = ["trashed = false"];
    if (opts.mimeType)  queryParts.push(`mimeType = '${opts.mimeType}'`);
    if (opts.starred)   queryParts.push("starred = true");
    if (opts.folderId)  queryParts.push(`'${opts.folderId}' in parents`);
    const q = queryParts.join(" and ");

    const res = await drive.files.list({
      q,
      pageSize: Math.min(opts.maxResults ?? 20, 50),
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,starred,iconLink)",
    });

    const files: DriveFile[] = (res.data.files ?? []).map((f) => ({
      id:           f.id ?? "",
      name:         f.name ?? "",
      mimeType:     f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? null,
      size:         f.size ?? null,
      webViewLink:  f.webViewLink ?? null,
      starred:      f.starred ?? false,
      iconLink:     f.iconLink ?? null,
    }));

    return { files };
  } catch (err) {
    return { files: [], error: `Drive API error: ${String(err)}` };
  }
}

// ── Search files ──────────────────────────────────────────────────────────────

export async function searchDriveFiles(
  query: string,
  maxResults = 20,
): Promise<{ files: DriveFile[]; error?: string }> {
  const auth = await getAuthenticatedClient();
  if (!auth) return { files: [], error: "Google Drive not connected." };

  try {
    const drive = google.drive({ version: "v3", auth });

    // Escape single quotes in user query for Drive API
    const escaped = query.replace(/'/g, "\\'");
    const q = `fullText contains '${escaped}' and trashed = false`;

    const res = await drive.files.list({
      q,
      pageSize: Math.min(maxResults, 50),
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,starred,iconLink)",
    });

    const files: DriveFile[] = (res.data.files ?? []).map((f) => ({
      id:           f.id ?? "",
      name:         f.name ?? "",
      mimeType:     f.mimeType ?? "",
      modifiedTime: f.modifiedTime ?? null,
      size:         f.size ?? null,
      webViewLink:  f.webViewLink ?? null,
      starred:      f.starred ?? false,
      iconLink:     f.iconLink ?? null,
    }));

    return { files };
  } catch (err) {
    return { files: [], error: `Drive API error: ${String(err)}` };
  }
}

// ── Get file content ──────────────────────────────────────────────────────────

export async function getDriveFileContent(fileId: string): Promise<{
  id: string;
  name: string;
  mimeType: string;
  content: string | null;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  error?: string;
}> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return {
      id: fileId, name: "", mimeType: "", content: null,
      modifiedTime: null, size: null, webViewLink: null,
      error: "Google Drive not connected.",
    };
  }

  try {
    const drive = google.drive({ version: "v3", auth });

    // Fetch metadata first
    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType,modifiedTime,size,webViewLink",
    });

    const base = {
      id:           meta.data.id ?? fileId,
      name:         meta.data.name ?? "",
      mimeType:     meta.data.mimeType ?? "",
      modifiedTime: meta.data.modifiedTime ?? null,
      size:         meta.data.size ?? null,
      webViewLink:  meta.data.webViewLink ?? null,
    };

    const mimeType = meta.data.mimeType ?? "";
    let content: string | null = null;

    if (mimeType === "application/vnd.google-apps.document") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" },
      );
      content = typeof res.data === "string" ? res.data.slice(0, 8000) : null;

    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/csv" },
        { responseType: "text" },
      );
      content = typeof res.data === "string" ? res.data.slice(0, 8000) : null;

    } else if (mimeType === "application/vnd.google-apps.presentation") {
      const res = await drive.files.export(
        { fileId, mimeType: "text/plain" },
        { responseType: "text" },
      );
      content = typeof res.data === "string" ? res.data.slice(0, 8000) : null;

    } else if (mimeType.startsWith("text/")) {
      const res = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" },
      );
      const rawData = res.data as unknown;
      content = typeof rawData === "string" ? rawData.slice(0, 8000) : null;

    } else {
      // Binary file (PDF, images, etc.) — metadata only
      content = null;
    }

    return { ...base, content };
  } catch (err) {
    return {
      id: fileId, name: "", mimeType: "", content: null,
      modifiedTime: null, size: null, webViewLink: null,
      error: `Drive API error: ${String(err)}`,
    };
  }
}

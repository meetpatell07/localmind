"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { FolderOpen, Upload, Search, File, FileText, FileImage, Archive } from "lucide-react";

interface VaultFile {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[] | null;
  createdAt: string;
}

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="h-3.5 w-3.5" />;
  if (mime.startsWith("image/")) return <FileImage className="h-3.5 w-3.5" />;
  if (mime.startsWith("text/") || mime.includes("pdf")) return <FileText className="h-3.5 w-3.5" />;
  if (mime.includes("zip") || mime.includes("tar")) return <Archive className="h-3.5 w-3.5" />;
  return <File className="h-3.5 w-3.5" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const url = q ? `/api/files?q=${encodeURIComponent(q)}` : "/api/files";
      const res = await fetch(url);
      const data = await res.json() as { files: VaultFile[] };
      setFiles(data.files ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const data = await res.json() as { file: VaultFile };
      setFiles((prev) => [data.file, ...prev]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") load(search);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-display italic text-2xl leading-none" style={{ color: "var(--amber)" }}>
              Vault
            </h1>
            <p className="font-mono text-[10px] opacity-25 mt-1">
              {files.length} files · local storage
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="font-mono text-[10px] opacity-30 animate-pulse">loading...</span>}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-sm disabled:opacity-40"
              style={{
                background: "rgba(240,160,21,0.08)",
                color: "var(--amber)",
                border: "1px solid rgba(240,160,21,0.2)",
              }}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? "uploading..." : "upload"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ border: "1px solid var(--line)", borderRadius: "3px", background: "var(--navy)" }}
        >
          <Search className="h-3.5 w-3.5 opacity-30 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="search files..."
            className="flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:opacity-20"
            style={{ color: "hsl(210 18% 80%)" }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); load(); }}
              className="font-mono text-[9px] opacity-30 hover:opacity-60"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FolderOpen className="h-8 w-8 opacity-10" />
            <p className="font-mono text-[11px] opacity-25">vault is empty</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="font-mono text-[11px] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: "var(--amber)" }}
            >
              upload your first file →
            </button>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div
              className="grid px-6 py-2 font-mono text-[9px] tracking-widest uppercase"
              style={{
                gridTemplateColumns: "1fr 80px 80px",
                color: "hsl(215 12% 40%)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>Name</span>
              <span className="text-right">Size</span>
              <span className="text-right">Date</span>
            </div>
            {files.map((f) => (
              <div
                key={f.id}
                className="grid px-6 py-2.5 hover:bg-white/[0.02] transition-colors"
                style={{
                  gridTemplateColumns: "1fr 80px 80px",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span style={{ color: "hsl(215 12% 40%)" }}>
                    <FileIcon mime={f.mimeType} />
                  </span>
                  <span
                    className="font-mono text-[12px] truncate"
                    style={{ color: "hsl(210 18% 80%)" }}
                  >
                    {f.fileName}
                  </span>
                  {(f.tags ?? []).length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {(f.tags ?? []).slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="font-mono text-[9px] px-1 py-0.5 rounded-sm"
                          style={{ background: "rgba(255,255,255,0.04)", color: "hsl(215 12% 45%)" }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span
                  className="font-mono text-[10px] text-right self-center opacity-30"
                >
                  {formatBytes(f.sizeBytes)}
                </span>
                <span
                  className="font-mono text-[10px] text-right self-center opacity-30"
                >
                  {new Date(f.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

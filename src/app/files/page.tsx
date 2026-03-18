"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FolderOpenIcon,
  Upload01Icon,
  Search01Icon,
  File01Icon,
  FileAttachmentIcon,
  Image01Icon,
  Archive02Icon,
  Cancel01Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";

interface VaultFile {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[] | null;
  createdAt: string;
}

const MIME_CONFIG: Record<string, { icon: typeof File01Icon; color: string; bg: string }> = {
  image:   { icon: Image01Icon,          color: "text-violet-500", bg: "bg-violet-50" },
  text:    { icon: FileAttachmentIcon,   color: "text-blue-500",   bg: "bg-blue-50" },
  pdf:     { icon: FileAttachmentIcon,   color: "text-red-500",    bg: "bg-red-50" },
  archive: { icon: Archive02Icon,        color: "text-amber-500",  bg: "bg-amber-50" },
  default: { icon: File01Icon,           color: "text-gray-400",   bg: "bg-gray-50" },
};

function getFileConfig(mime: string | null) {
  if (!mime) return MIME_CONFIG.default;
  if (mime.startsWith("image/")) return MIME_CONFIG.image;
  if (mime.includes("pdf")) return MIME_CONFIG.pdf;
  if (mime.startsWith("text/")) return MIME_CONFIG.text;
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("gz")) return MIME_CONFIG.archive;
  return MIME_CONFIG.default;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
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

  async function uploadFile(file: File) {
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

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleSearchKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") load(search);
  }

  const totalSize = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);

  return (
    <div
      className="flex flex-col h-full overflow-hidden animate-fade-in"
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-4 shrink-0 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vault</h1>
            <p className="text-sm text-gray-500 mt-1">
              {files.length} {files.length === 1 ? "file" : "files"} · {formatBytes(totalSize)} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs font-medium text-gray-400 animate-pulse">Loading...</span>}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs gap-1.5"
            >
              <Upload01Icon className="size-3.5" />
              {uploading ? "Uploading..." : "Upload file"}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className={cn(
          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border bg-white transition-all",
          search
            ? "border-gray-300 shadow-sm ring-1 ring-gray-100"
            : "border-gray-200 hover:border-gray-300"
        )}>
          <Search01Icon className={cn(
            "size-4 shrink-0 transition-colors",
            search ? "text-gray-500" : "text-gray-300",
          )} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent border-none h-auto p-0 text-sm text-gray-900 focus-visible:ring-0 placeholder:text-gray-400"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); load(); }}
              className="p-1 rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Cancel01Icon className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50">
            <Upload01Icon className="size-8 text-blue-400" />
            <p className="text-sm font-medium text-blue-600">Drop file to upload</p>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="size-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <FolderOpenIcon className="size-7 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">Vault is empty</p>
              <p className="text-xs text-gray-400 mt-1">Upload a file or drag and drop</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs gap-1.5"
            >
              <Upload01Icon className="size-3.5" />
              Upload your first file
            </Button>
          </div>
        ) : (
          <div className="px-4 md:px-6 py-2">
            {/* Column headers */}
            <div className="grid px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
              style={{ gridTemplateColumns: "1fr 80px 90px" }}
            >
              <span>Name</span>
              <span className="text-right">Size</span>
              <span className="text-right">Added</span>
            </div>

            {/* File rows */}
            <div className="space-y-0.5">
              {files.map((f) => {
                const config = getFileConfig(f.mimeType);
                const Icon = config.icon;
                return (
                  <div
                    key={f.id}
                    className="grid items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-default"
                    style={{ gridTemplateColumns: "1fr 80px 90px" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0",
                        config.bg,
                      )}>
                        <Icon className={cn("size-4", config.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {f.fileName}
                        </p>
                        {(f.tags ?? []).length > 0 && (
                          <div className="flex gap-1 mt-0.5">
                            {(f.tags ?? []).slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 text-right tabular-nums">
                      {formatBytes(f.sizeBytes)}
                    </span>
                    <span className="text-xs text-gray-400 text-right">
                      {new Date(f.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

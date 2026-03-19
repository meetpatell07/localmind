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
  ViewIcon,
  ListViewIcon,
  Folder01Icon,
  Loading03Icon,
  AiBrain02Icon,
  ArrowLeft01Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";

interface VaultFile {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  tags: string[] | null;
  summary: string | null;
  category: string | null;
  source: string | null;
  createdAt: string;
}

const MIME_CONFIG: Record<string, { icon: typeof File01Icon; color: string; bg: string }> = {
  image:   { icon: Image01Icon,          color: "text-violet-500", bg: "bg-violet-50" },
  text:    { icon: FileAttachmentIcon,   color: "text-blue-500",   bg: "bg-blue-50" },
  pdf:     { icon: FileAttachmentIcon,   color: "text-red-500",    bg: "bg-red-50" },
  archive: { icon: Archive02Icon,        color: "text-amber-500",  bg: "bg-amber-50" },
  default: { icon: File01Icon,           color: "text-gray-400",   bg: "bg-gray-50" },
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  Finance:   { bg: "bg-emerald-50",  border: "border-emerald-100", icon: "text-emerald-600" },
  Code:      { bg: "bg-blue-50",     border: "border-blue-100",    icon: "text-blue-600"    },
  Documents: { bg: "bg-amber-50",    border: "border-amber-100",   icon: "text-amber-600"   },
  Images:    { bg: "bg-violet-50",   border: "border-violet-100",  icon: "text-violet-600"  },
  Notes:     { bg: "bg-yellow-50",   border: "border-yellow-100",  icon: "text-yellow-600"  },
  Archive:   { bg: "bg-orange-50",   border: "border-orange-100",  icon: "text-orange-600"  },
  Media:     { bg: "bg-pink-50",     border: "border-pink-100",    icon: "text-pink-600"    },
  Design:    { bg: "bg-purple-50",   border: "border-purple-100",  icon: "text-purple-600"  },
  Data:      { bg: "bg-cyan-50",     border: "border-cyan-100",    icon: "text-cyan-600"    },
  Other:     { bg: "bg-gray-50",     border: "border-gray-100",    icon: "text-gray-500"    },
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

function FileRow({ f }: { f: VaultFile }) {
  const config = getFileConfig(f.mimeType);
  const Icon = config.icon;
  return (
    <div
      className="grid items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group cursor-default"
      style={{ gridTemplateColumns: "1fr 80px 90px" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", config.bg)}>
          <Icon className={cn("size-4", config.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-800 truncate">{f.fileName}</p>
          {f.summary ? (
            <p className="text-[11px] text-gray-400 truncate mt-0.5">{f.summary}</p>
          ) : (f.tags ?? []).length > 0 ? (
            <div className="flex gap-1 mt-0.5">
              {(f.tags ?? []).slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-right">
        <span className="text-xs text-gray-400 tabular-nums">{formatBytes(f.sizeBytes)}</span>
        {f.source === "telegram" && (
          <p className="text-[10px] text-blue-400 font-medium">Telegram</p>
        )}
      </div>
      <span className="text-xs text-gray-400 text-right">
        {new Date(f.createdAt).toLocaleDateString("en", { month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

function FolderCard({
  category,
  files,
  onOpen,
}: {
  category: string;
  files: VaultFile[];
  onOpen: () => void;
}) {
  const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other;
  const totalSize = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);

  return (
    <button
      onClick={onOpen}
      className={cn(
        "flex flex-col gap-3 p-5 rounded-2xl border text-left transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
        colors.bg, colors.border
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("size-11 rounded-xl flex items-center justify-center bg-white/60 border", colors.border)}>
          <Folder01Icon className={cn("size-5", colors.icon)} />
        </div>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 border", colors.border, colors.icon)}>
          {files.length}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{category}</p>
        <p className="text-xs text-gray-500 mt-0.5">{formatBytes(totalSize)}</p>
      </div>
      <div className="space-y-0.5">
        {files.slice(0, 3).map((f) => (
          <p key={f.id} className="text-[11px] text-gray-500 truncate">{f.fileName}</p>
        ))}
        {files.length > 3 && (
          <p className="text-[11px] text-gray-400 font-medium">+{files.length - 3} more</p>
        )}
      </div>
    </button>
  );
}

function FileTable({ files }: { files: VaultFile[] }) {
  return (
    <>
      <div
        className="grid px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider"
        style={{ gridTemplateColumns: "1fr 80px 90px" }}
      >
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="text-right">Added</span>
      </div>
      <div className="space-y-0.5">
        {files.map((f) => <FileRow key={f.id} f={f} />)}
      </div>
    </>
  );
}

function EmptyVault({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="size-14 rounded-2xl bg-gray-50 flex items-center justify-center">
        <FolderOpenIcon className="size-7 text-gray-300" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-500">Vault is empty</p>
        <p className="text-xs text-gray-400 mt-1">Upload a file or send one via Telegram</p>
      </div>
      <Button variant="outline" size="sm" onClick={onUpload} className="text-xs gap-1.5">
        <Upload01Icon className="size-3.5" />
        Upload your first file
      </Button>
    </div>
  );
}

type ViewMode = "list" | "canvas";

export default function FilesPage() {
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [grouped, setGrouped] = useState<Record<string, VaultFile[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("canvas");
  const [openFolder, setOpenFolder] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      if (viewMode === "canvas" && !q) {
        const res = await fetch("/api/files?view=canvas");
        const data = (await res.json()) as { grouped: Record<string, VaultFile[]> };
        setGrouped(data.grouped ?? {});
        setFiles(Object.values(data.grouped ?? {}).flat());
      } else {
        const url = q ? `/api/files?q=${encodeURIComponent(q)}` : "/api/files";
        const res = await fetch(url);
        const data = (await res.json()) as { files: VaultFile[] };
        setFiles(data.files ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [viewMode]);

  useEffect(() => { load(); }, [load]);

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/files", { method: "POST", body: fd });
      const data = (await res.json()) as { file: VaultFile };
      setFiles((prev) => [data.file, ...prev]);
      // Reload after ~3s so AI-analyzed category reflects in canvas
      setTimeout(() => load(), 3500);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadFile(f);
  }

  const totalSize = files.reduce((sum, f) => sum + (f.sizeBytes ?? 0), 0);
  const categoryEntries = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  const folderFiles = openFolder ? (grouped[openFolder] ?? []) : [];

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
          <div className="flex items-center gap-3">
            {openFolder && (
              <button
                onClick={() => setOpenFolder(null)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft01Icon className="size-4" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                {openFolder ?? "Vault"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {openFolder
                  ? `${folderFiles.length} file${folderFiles.length !== 1 ? "s" : ""}`
                  : `${files.length} file${files.length !== 1 ? "s" : ""} · ${formatBytes(totalSize)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!openFolder && (
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg">
                {(["canvas", "list"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); setSearch(""); setOpenFolder(null); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
                      viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {mode === "canvas" ? <ViewIcon className="size-3.5" /> : <ListViewIcon className="size-3.5" />}
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {loading && <Loading03Icon className="size-4 text-gray-300 animate-spin" />}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            <Button
              variant="default"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs gap-1.5"
            >
              <Upload01Icon className="size-3.5" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>

        {(viewMode === "list" || openFolder) && (
          <div className={cn(
            "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border bg-white transition-all",
            search ? "border-gray-300 shadow-sm ring-1 ring-gray-100" : "border-gray-200 hover:border-gray-300"
          )}>
            <Search01Icon className={cn("size-4 shrink-0 transition-colors", search ? "text-gray-500" : "text-gray-300")} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(search)}
              placeholder="Search files by name…"
              className="flex-1 bg-transparent border-none h-auto p-0 text-sm text-gray-900 focus-visible:ring-0 placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => { setSearch(""); load(); }} className="p-1 rounded-md text-gray-300 hover:text-gray-500 transition-colors">
                <Cancel01Icon className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/50">
            <Upload01Icon className="size-8 text-blue-400" />
            <p className="text-sm font-medium text-blue-600">Drop file to upload</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Canvas view */}
        {viewMode === "canvas" && !openFolder && (
          <div className="px-4 md:px-6 py-6">
            {categoryEntries.length === 0 && !loading ? (
              <EmptyVault onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-5 text-xs text-gray-400">
                  <AiBrain02Icon className="size-3.5 text-purple-400" />
                  Files are automatically categorized by AI after upload
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {categoryEntries.map(([cat, catFiles]) => (
                    <FolderCard
                      key={cat}
                      category={cat}
                      files={catFiles}
                      onOpen={() => setOpenFolder(cat)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Folder drill-down */}
        {viewMode === "canvas" && openFolder && (
          <div className="px-4 md:px-6 py-2">
            {folderFiles.length === 0 ? (
              <EmptyVault onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <FileTable files={folderFiles} />
            )}
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && (
          <div className="px-4 md:px-6 py-2">
            {files.length === 0 && !loading ? (
              <EmptyVault onUpload={() => fileInputRef.current?.click()} />
            ) : (
              <FileTable files={files} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

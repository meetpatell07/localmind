"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string | null;
  size: string | null;
  webViewLink: string | null;
  starred: boolean;
  iconLink: string | null;
}

interface DriveFileDetail extends DriveFile {
  content: string | null;
}

type ViewMode = "grid" | "list";
type FilterType = "all" | "doc" | "sheet" | "slide" | "pdf" | "image" | "other";

// ── Mime helpers ──────────────────────────────────────────────────────────────

function getMimeConfig(mimeType: string): {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  filter: FilterType;
} {
  if (mimeType === "application/vnd.google-apps.document")
    return { label: "Doc", emoji: "📄", color: "text-blue-700", bg: "bg-blue-50", filter: "doc" };
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return { label: "Sheet", emoji: "📊", color: "text-green-700", bg: "bg-green-50", filter: "sheet" };
  if (mimeType === "application/vnd.google-apps.presentation")
    return { label: "Slides", emoji: "📑", color: "text-yellow-700", bg: "bg-yellow-50", filter: "slide" };
  if (mimeType === "application/vnd.google-apps.form")
    return { label: "Form", emoji: "📋", color: "text-purple-700", bg: "bg-purple-50", filter: "other" };
  if (mimeType === "application/vnd.google-apps.folder")
    return { label: "Folder", emoji: "📁", color: "text-gray-700", bg: "bg-gray-100", filter: "other" };
  if (mimeType === "application/pdf")
    return { label: "PDF", emoji: "📕", color: "text-red-700", bg: "bg-red-50", filter: "pdf" };
  if (mimeType.startsWith("image/"))
    return { label: "Image", emoji: "🖼️", color: "text-pink-700", bg: "bg-pink-50", filter: "image" };
  if (mimeType === "text/plain")
    return { label: "Text", emoji: "📃", color: "text-gray-600", bg: "bg-gray-50", filter: "other" };
  return { label: mimeType.split("/").pop() ?? "File", emoji: "📎", color: "text-gray-600", bg: "bg-gray-50", filter: "other" };
}

function formatFileSize(size: string | null): string {
  if (!size) return "—";
  const bytes = Number(size);
  if (isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatModifiedTime(ts: string | null): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

const isBinaryMime = (mimeType: string) =>
  mimeType.startsWith("image/") ||
  mimeType === "application/pdf" ||
  (!mimeType.startsWith("text/") && !mimeType.startsWith("application/vnd.google-apps"));

// ── Skeletons ─────────────────────────────────────────────────────────────────

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 flex flex-col gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100" />
          <div className="space-y-1.5">
            <div className="h-3 bg-gray-100 rounded w-4/5" />
            <div className="h-3 bg-gray-50 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-gray-50">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 bg-gray-100 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3.5 bg-gray-100 rounded w-2/3" />
            <div className="h-3 bg-gray-50 rounded w-1/3" />
          </div>
          <div className="w-16 h-3 bg-gray-50 rounded hidden sm:block" />
          <div className="w-14 h-3 bg-gray-50 rounded hidden md:block" />
        </div>
      ))}
    </div>
  );
}

// ── File Card (Grid) ──────────────────────────────────────────────────────────

function FileCard({ file, onClick, isSelected }: { file: DriveFile; onClick: () => void; isSelected: boolean }) {
  const mime = getMimeConfig(file.mimeType);
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-xl border bg-white p-4 flex flex-col gap-3 transition-all duration-150",
        "hover:shadow-md hover:border-gray-200",
        isSelected ? "border-blue-300 ring-2 ring-blue-100 shadow-md" : "border-gray-100"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0", mime.bg)}>
          {mime.emoji}
        </div>
        {file.starred && (
          <span className="text-amber-400 text-sm shrink-0" title="Starred">★</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-900 truncate leading-5 group-hover:text-blue-600 transition-colors">
          {file.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", mime.bg, mime.color)}>
            {mime.label}
          </span>
          <span className="text-[10px] text-gray-400">{formatModifiedTime(file.modifiedTime)}</span>
        </div>
      </div>
    </button>
  );
}

// ── File Row (List) ───────────────────────────────────────────────────────────

function FileRow({ file, onClick, isSelected }: { file: DriveFile; onClick: () => void; isSelected: boolean }) {
  const mime = getMimeConfig(file.mimeType);
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 transition-colors",
        "hover:bg-gray-50",
        isSelected && "bg-blue-50/60 border-l-2 border-l-blue-400"
      )}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0", mime.bg)}>
        {mime.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
          {file.name}
          {file.starred && <span className="ml-1.5 text-amber-400 text-[10px]">★</span>}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5 sm:hidden">{mime.label} · {formatModifiedTime(file.modifiedTime)}</p>
      </div>
      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full hidden sm:inline-flex", mime.bg, mime.color)}>
        {mime.label}
      </span>
      <span className="text-xs text-gray-400 whitespace-nowrap hidden md:block w-20 text-right">
        {formatModifiedTime(file.modifiedTime)}
      </span>
      <span className="text-xs text-gray-400 whitespace-nowrap hidden lg:block w-16 text-right">
        {formatFileSize(file.size)}
      </span>
      <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ── Side Panel ────────────────────────────────────────────────────────────────

function SidePanel({ file, onClose }: { file: DriveFile; onClose: () => void }) {
  const router = useRouter();
  const mime = getMimeConfig(file.mimeType);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentFetched, setContentFetched] = useState(false);
  const binary = isBinaryMime(file.mimeType);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleReadContent() {
    setContentLoading(true);
    try {
      const res = await fetch(`/api/drive/file?id=${encodeURIComponent(file.id)}`);
      const data = await res.json() as DriveFileDetail & { error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Failed to read file");
      } else {
        setContent(data.content);
        setContentFetched(true);
        if (!data.content) toast.info("No readable text content for this file type.");
      }
    } catch {
      toast.error("Failed to fetch file content");
    } finally {
      setContentLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-4 border-b border-gray-100 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0", mime.bg)}>
            {mime.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-5 break-words">{file.name}</h3>
            <span className={cn("mt-1 inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full", mime.bg, mime.color)}>
              {mime.label}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 p-1 rounded-lg hover:bg-gray-100"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
        {[
          { label: "Modified", value: formatModifiedTime(file.modifiedTime) },
          { label: "Size", value: formatFileSize(file.size) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 flex flex-col gap-2 border-b border-gray-100">
        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Google Drive
          </a>
        )}
        {!binary && !contentFetched && (
          <button
            onClick={handleReadContent}
            disabled={contentLoading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:opacity-50"
          >
            {contentLoading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Reading content…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Read file content
              </>
            )}
          </button>
        )}
        <button
          onClick={() => router.push("/chat")}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ask AI about this file
        </button>
      </div>

      {/* Content preview */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {binary && (
          <p className="text-xs text-gray-400 italic">
            Binary file — content preview not available.
          </p>
        )}
        {contentFetched && (
          content ? (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 rounded-lg p-3">
              {content}
            </pre>
          ) : (
            <p className="text-xs text-gray-400 italic">No text content available for this file type.</p>
          )
        )}
        {!binary && !contentFetched && !contentLoading && (
          <p className="text-xs text-gray-400">Click "Read file content" to preview the text.</p>
        )}
      </div>
    </div>
  );
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "all",   label: "All" },
  { value: "doc",   label: "Docs" },
  { value: "sheet", label: "Sheets" },
  { value: "slide", label: "Slides" },
  { value: "pdf",   label: "PDFs" },
  { value: "image", label: "Images" },
  { value: "other", label: "Other" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DrivePage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter, setFilter] = useState<FilterType>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  // Check connection on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/connectors/status");
        const data = await res.json() as {
          connectors?: { google?: { connected?: boolean; services?: string[] } };
        };
        const google = data.connectors?.google;
        const hasDrive =
          google?.connected === true &&
          Array.isArray(google.services) &&
          google.services.includes("drive");
        setConnected(hasDrive);
        if (hasDrive) await loadFiles();
        else setLoading(false);
      } catch {
        setConnected(false);
        setLoading(false);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const loadFiles = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ max: "50" });
      if (query?.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/drive?${params.toString()}`);
      const data = await res.json() as { files?: DriveFile[]; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Failed to load Drive files");
        setFiles([]);
      } else {
        setFiles(data.files ?? []);
      }
    } catch {
      toast.error("Failed to fetch Drive files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch() {
    setActiveSearch(search);
    setSelectedFile(null);
    void loadFiles(search);
  }

  function handleClear() {
    setSearch("");
    setActiveSearch("");
    setSelectedFile(null);
    void loadFiles();
  }

  // Apply client-side filter
  const filteredFiles =
    filter === "all"
      ? files
      : files.filter((f) => getMimeConfig(f.mimeType).filter === filter);

  // Count per filter
  const counts = FILTERS.reduce<Record<FilterType, number>>((acc, f) => {
    acc[f.value] =
      f.value === "all"
        ? files.length
        : files.filter((file) => getMimeConfig(file.mimeType).filter === f.value).length;
    return acc;
  }, {} as Record<FilterType, number>);

  // ── Not connected ──────────────────────────────────────────────────────────

  if (connected === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-5">
          ☁️
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Connect Google Drive</h2>
        <p className="text-sm text-gray-500 max-w-xs mb-6 leading-relaxed">
          Link your Google account to browse, search, and let your AI read your Drive files.
        </p>
        <a
          href="/api/connectors/google/auth"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground hover:opacity-90 text-background text-sm font-medium rounded-lg transition-opacity"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" opacity=".3"/>
            <path d="M12 3C6.48 3 2 7.48 2 13h2c0-4.42 3.58-8 8-8s8 3.58 8 8h2c0-5.52-4.48-10-10-10z"/>
          </svg>
          Connect Google Drive
        </a>
      </div>
    );
  }

  // ── Loading state (initial) ────────────────────────────────────────────────

  if (connected === null) {
    return (
      <div className="flex-1 p-4">
        {viewMode === "grid" ? <GridSkeleton /> : <ListSkeleton />}
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: file browser */}
      <div className={cn(
        "flex flex-col min-w-0 transition-all duration-200",
        selectedFile ? "w-0 md:flex-1 hidden md:flex" : "flex-1"
      )}>
        {/* Toolbar */}
        <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search Drive… (⌘K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
            />
            {search && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Search button */}
          <button
            onClick={handleSearch}
            className="px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity shrink-0"
          >
            Search
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* File count */}
          <span className="text-xs text-gray-400 hidden sm:block shrink-0">
            {filteredFiles.length} file{filteredFiles.length !== 1 ? "s" : ""}
          </span>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "list" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
              aria-label="List view"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                viewMode === "grid" ? "bg-white shadow-sm text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
              aria-label="Grid view"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 overflow-x-auto no-scrollbar">
          {FILTERS.filter((f) => counts[f.value] > 0 || f.value === "all").map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full shrink-0 transition-colors",
                filter === f.value
                  ? "bg-foreground text-background"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.label}
              {counts[f.value] > 0 && (
                <span className={cn(
                  "text-[10px] font-semibold min-w-[14px] text-center",
                  filter === f.value ? "text-background/70" : "text-gray-400"
                )}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          ))}

          {activeSearch && (
            <span className="ml-auto shrink-0 text-[10px] text-gray-400 flex items-center gap-1">
              Results for <span className="font-medium text-gray-600">"{activeSearch}"</span>
              <button onClick={handleClear} className="text-gray-400 hover:text-gray-600 ml-0.5">×</button>
            </span>
          )}
        </div>

        {/* Files */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            viewMode === "grid" ? <GridSkeleton /> : <ListSkeleton />
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="text-4xl mb-3">
                {activeSearch ? "🔍" : "📂"}
              </div>
              <p className="text-sm font-medium text-gray-600">No files found</p>
              <p className="text-xs text-gray-400 mt-1">
                {activeSearch
                  ? `No results for "${activeSearch}"`
                  : filter !== "all"
                  ? `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? ""} in your Drive`
                  : "Your Drive appears to be empty"
                }
              </p>
              {(activeSearch || filter !== "all") && (
                <button
                  onClick={() => { setFilter("all"); handleClear(); }}
                  className="mt-4 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
              {filteredFiles.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                  isSelected={selectedFile?.id === file.id}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y-0">
              {/* List header */}
              <div className="sticky top-0 flex items-center gap-3 px-4 py-2 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
                <div className="w-8 shrink-0" />
                <div className="flex-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Name</div>
                <div className="hidden sm:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-16">Type</div>
                <div className="hidden md:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20 text-right">Modified</div>
                <div className="hidden lg:block text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-16 text-right">Size</div>
                <div className="w-3.5 shrink-0" />
              </div>
              {filteredFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  onClick={() => setSelectedFile(selectedFile?.id === file.id ? null : file)}
                  isSelected={selectedFile?.id === file.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: side panel */}
      {selectedFile && (
        <div className={cn(
          "flex flex-col shrink-0 transition-all duration-200",
          "w-full md:w-80 lg:w-96"
        )}>
          <SidePanel file={selectedFile} onClose={() => setSelectedFile(null)} />
        </div>
      )}
    </div>
  );
}

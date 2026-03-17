"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";
import { Loader2, Check, Database, Brain, ListTodo, Search, User, GitBranch } from "lucide-react";

interface MessageBubbleProps {
  message: UIMessage;
}

// ── Tool call display ─────────────────────────────────────────────────────────

type ToolState = "partial-call" | "call" | "result";

interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    toolName: string;
    state: ToolState;
    args?: Record<string, unknown>;
    result?: unknown;
  };
}

const TOOL_META: Record<string, { icon: React.ElementType; verb: string }> = {
  update_profile:        { icon: User,       verb: "Updating profile"        },
  save_memory:           { icon: Brain,      verb: "Saving to memory"        },
  recall_memories:       { icon: Search,     verb: "Searching memory"        },
  query_knowledge_graph: { icon: GitBranch,  verb: "Querying knowledge graph" },
  create_task:           { icon: ListTodo,   verb: "Creating task"           },
  get_my_profile:        { icon: Database,   verb: "Reading profile"         },
  // Email tools
  list_emails:           { icon: Database,   verb: "Fetching inbox"          },
  search_emails:         { icon: Search,     verb: "Searching emails"        },
  get_email:             { icon: Database,   verb: "Reading email"           },
};

function toolResultSummary(name: string, result: unknown): string {
  const r = result as Record<string, unknown> | null;
  if (!r) return "done";

  switch (name) {
    case "update_profile":
      return r.success
        ? String(r.message ?? "profile updated")
        : `error: ${String(r.error ?? "unknown")}`;
    case "save_memory":
      return r.success ? "saved to memory" : `error: ${String(r.error ?? "unknown")}`;
    case "recall_memories":
      return r.found
        ? `found ${(r.memories as unknown[])?.length ?? 0} memories${r.fromCache ? " (cached)" : ""}`
        : "no memories found";
    case "query_knowledge_graph":
      return r.found
        ? `found ${(r.entities as unknown[])?.length ?? 0} entities`
        : String(r.message ?? "nothing found");
    case "create_task":
      return r.success
        ? `task created: "${(r.task as Record<string, unknown>)?.title ?? ""}"`
        : `error: ${String(r.error ?? "unknown")}`;
    case "get_my_profile":
      return r.profile
        ? `${Object.keys(r.profile as object).length} fields loaded`
        : "no profile saved yet";
    case "list_emails":
      return r.error
        ? `error: ${String(r.error)}`
        : `${(r.emails as unknown[])?.length ?? 0} emails`;
    case "search_emails":
      return r.error
        ? `error: ${String(r.error)}`
        : `${(r.emails as unknown[])?.length ?? 0} results`;
    case "get_email":
      return r.error ? `error: ${String(r.error)}` : "email loaded";
    default:
      return "done";
  }
}

function ToolCallBadge({ part }: { part: ToolInvocationPart }) {
  const { toolName, state, result } = part.toolInvocation;
  const meta = TOOL_META[toolName] ?? { icon: Database, verb: toolName };
  const Icon = meta.icon;
  const isRunning = state === "call" || state === "partial-call";
  const isDone = state === "result";
  const isSuccess = isDone && (result as Record<string, unknown>)?.success !== false
    && (result as Record<string, unknown>)?.found !== false
    || (isDone && toolName === "get_my_profile");

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm my-1 w-fit font-mono text-[10px]"
      style={{
        background: isRunning
          ? "rgba(240,160,21,0.06)"
          : isSuccess
          ? "rgba(74,222,128,0.06)"
          : "rgba(248,113,113,0.06)",
        border: `1px solid ${isRunning
          ? "rgba(240,160,21,0.2)"
          : isSuccess
          ? "rgba(74,222,128,0.15)"
          : "rgba(248,113,113,0.15)"}`,
        color: isRunning
          ? "var(--amber)"
          : isSuccess
          ? "#4ade80"
          : "#f87171",
      }}
    >
      {isRunning ? (
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <Check className="h-3 w-3 shrink-0" />
      )}
      <Icon className="h-3 w-3 shrink-0 opacity-70" />
      <span>
        {isRunning
          ? `${meta.verb}…`
          : toolResultSummary(toolName, result)}
      </span>
    </div>
  );
}

// ── Markdown text block ────────────────────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div
      className="px-4 py-3 rounded-sm text-[13px] leading-relaxed"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--line)",
        color: "hsl(210 18% 78%)",
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose-localmind"
        components={{
          pre: ({ children }) => (
            <pre
              className="overflow-x-auto rounded-sm p-3 text-xs my-3 font-mono"
              style={{
                background: "var(--navy)",
                border: "1px solid var(--line)",
                color: "hsl(210 18% 70%)",
              }}
            >
              {children}
            </pre>
          ),
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <code className={className}>{children}</code>
            ) : (
              <code
                className="rounded-sm px-1.5 py-0.5 text-xs font-mono"
                style={{
                  background: "var(--navy)",
                  border: "1px solid var(--line)",
                  color: "hsl(48 80% 70%)",
                }}
              >
                {children}
              </code>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // ── User bubble ─────────────────────────────────────────────────────────────
  if (isUser) {
    const text = message.parts?.length
      ? message.parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("")
      : (message as unknown as { content: string }).content ?? "";

    if (!text) return null;
    return (
      <div className="flex gap-3 w-full flex-row-reverse">
        <span
          className="font-mono text-[9px] shrink-0 mt-1 w-8 text-right leading-none"
          style={{ color: "var(--amber)", paddingTop: "3px" }}
        >
          you
        </span>
        <div
          className="max-w-[80%] px-4 py-3 rounded-sm"
          style={{
            background: "var(--amber-dim)",
            border: "1px solid rgba(240,160,21,0.2)",
            color: "var(--amber)",
          }}
        >
          <p className="whitespace-pre-wrap font-mono text-[12px]">{text}</p>
        </div>
      </div>
    );
  }

  // ── Assistant bubble — render parts in document order ───────────────────────
  // This ensures pre-tool narration text appears BEFORE the tool badge,
  // and post-tool response text appears AFTER it. Streaming-safe.
  const parts = message.parts ?? [];
  const hasContent = parts.some(
    (p) => (p.type === "text" && (p as { text: string }).text?.trim()) || p.type === "tool-invocation"
  );

  // Fallback: legacy messages without parts
  if (!hasContent) {
    const text = (message as unknown as { content: string }).content ?? "";
    if (!text) return null;
    return (
      <div className="flex gap-3 w-full flex-row">
        <span className="font-mono text-[9px] shrink-0 mt-1 w-8 text-right leading-none" style={{ color: "hsl(215 12% 35%)", paddingTop: "3px" }}>ai</span>
        <div className="flex flex-col gap-0.5 max-w-[80%]">
          <TextBlock text={text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 w-full flex-row">
      <span
        className="font-mono text-[9px] shrink-0 mt-1 w-8 text-right leading-none"
        style={{ color: "hsl(215 12% 35%)", paddingTop: "3px" }}
      >
        ai
      </span>

      {/* Parts rendered in document order — narration → tool badge → response */}
      <div className="flex flex-col gap-0.5 max-w-[80%]">
        {parts.map((part, i) => {
          if (part.type === "text") {
            return <TextBlock key={i} text={(part as { text: string }).text} />;
          }
          if (part.type === "tool-invocation") {
            return <ToolCallBadge key={i} part={part as unknown as ToolInvocationPart} />;
          }
          return null;
        })}
      </div>
    </div>
  );
}

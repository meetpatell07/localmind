"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";
import { Loading03Icon, CheckmarkCircle01Icon, Database01Icon, Brain02Icon, CheckListIcon, Search01Icon, UserIcon, GitBranchIcon } from "hugeicons-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: UIMessage;
  /** True for the single assistant message currently receiving tokens. */
  isStreamingThis?: boolean;
}

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
  update_profile:        { icon: UserIcon,         verb: "Updating profile"        },
  save_memory:           { icon: Brain02Icon,      verb: "Saving to memory"        },
  recall_memories:       { icon: Search01Icon,     verb: "Searching memory"        },
  query_knowledge_graph: { icon: GitBranchIcon,    verb: "Querying knowledge graph" },
  create_task:           { icon: CheckListIcon,    verb: "Creating task"           },
  get_my_profile:        { icon: Database01Icon,   verb: "Reading profile"         },
  list_emails:           { icon: Database01Icon,   verb: "Fetching inbox"          },
  search_emails:         { icon: Search01Icon,     verb: "Searching emails"        },
  get_email:             { icon: Database01Icon,   verb: "Reading email"           },
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
  const meta = TOOL_META[toolName] ?? { icon: Database01Icon, verb: toolName };
  const Icon = meta.icon;
  const isRunning = state === "call" || state === "partial-call";
  const isDone = state === "result";
  const isSuccess = isDone && (result as Record<string, unknown>)?.success !== false
    && (result as Record<string, unknown>)?.found !== false
    || (isDone && toolName === "get_my_profile");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full my-0.5 w-fit text-xs font-medium border",
        isRunning && "bg-amber-50/80 border-amber-200/60 text-amber-700",
        isDone && isSuccess && "bg-emerald-50/80 border-emerald-200/60 text-emerald-700",
        isDone && !isSuccess && "bg-red-50/80 border-red-200/60 text-red-700",
      )}
    >
      {isRunning ? (
        <Loading03Icon className="size-3 animate-spin shrink-0" />
      ) : (
        <CheckmarkCircle01Icon className="size-3 shrink-0" />
      )}
      <Icon className="size-3 shrink-0 opacity-60" />
      <span>
        {isRunning
          ? `${meta.verb}…`
          : toolResultSummary(toolName, result)}
      </span>
    </div>
  );
}

function TextBlock({ text, showCursor }: { text: string; showCursor?: boolean }) {
  if (!text.trim()) return null;
  return (
    <div className="text-sm leading-relaxed text-gray-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:text-gray-900 prose-headings:font-semibold prose-code:text-gray-800 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2"
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl p-3.5 text-[13px] my-3 bg-gray-50 border border-gray-100 text-gray-800">
              {children}
            </pre>
          ),
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded-md px-1.5 py-0.5 text-[13px] bg-gray-100 text-gray-700">
                {children}
              </code>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
      {showCursor && (
        <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 align-middle animate-[blink_1s_step-end_infinite]" />
      )}
    </div>
  );
}

export function MessageBubble({ message, isStreamingThis = false }: MessageBubbleProps) {
  const isUser = message.role === "user";

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
        <div className="size-7 rounded-full bg-gray-900 flex items-center justify-center text-xs font-semibold text-white shrink-0 shadow-sm">
          M
        </div>
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gray-900 text-white">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    );
  }

  const parts = message.parts ?? [];
  const hasContent = parts.some(
    (p) => (p.type === "text" && (p as { text: string }).text?.trim()) || p.type === "tool-invocation"
  );

  if (!hasContent) {
    const text = (message as unknown as { content: string }).content ?? "";
    if (!text) return null;
    return (
      <div className="flex gap-3 w-full flex-row">
        <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 shadow-sm">
          AI
        </div>
        <div className="flex flex-col gap-1 max-w-[80%] pt-0.5">
          <TextBlock text={text} showCursor={isStreamingThis} />
        </div>
      </div>
    );
  }

  // Find index of the last text part so only that one gets the cursor
  const lastTextIdx = parts.reduce(
    (acc, p, i) => (p.type === "text" ? i : acc),
    -1,
  );

  return (
    <div className="flex gap-3 w-full flex-row">
      <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0 shadow-sm">
        AI
      </div>
      <div className="flex flex-col gap-1 max-w-[80%] pt-0.5">
        {parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <TextBlock
                key={i}
                text={(part as { text: string }).text}
                showCursor={isStreamingThis && i === lastTextIdx}
              />
            );
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

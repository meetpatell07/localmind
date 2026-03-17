"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";
import { Loading03Icon, CheckmarkCircle01Icon, Database01Icon, Brain02Icon, CheckListIcon, Search01Icon, UserIcon, GitBranchIcon } from "hugeicons-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: UIMessage;
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
        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg my-1 w-fit text-sm border",
        isRunning && "bg-amber-50 border-amber-200 text-amber-700",
        isDone && isSuccess && "bg-green-50 border-green-200 text-green-700",
        isDone && !isSuccess && "bg-red-50 border-red-200 text-red-700",
      )}
    >
      {isRunning ? (
        <Loading03Icon className="h-3 w-3 animate-spin shrink-0" />
      ) : (
        <CheckmarkCircle01Icon className="h-3 w-3 shrink-0" />
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

function TextBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="px-4 py-3 rounded-lg text-sm leading-relaxed border border-border bg-white text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        className="prose prose-sm max-w-none prose-p:my-1 prose-headings:text-foreground prose-code:text-foreground"
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg p-3 text-sm my-3 bg-gray-50 border border-border text-foreground">
              {children}
            </pre>
          ),
          code: ({ children, className }) =>
            className?.includes("language-") ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded-md px-1.5 py-0.5 text-sm bg-gray-100 border border-border text-foreground">
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

export function MessageBubble({ message }: MessageBubbleProps) {
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
        <div className="size-7 rounded-full bg-foreground flex items-center justify-center text-sm font-medium text-background shrink-0">
          M
        </div>
        <div className="max-w-[80%] px-4 py-3 rounded-lg bg-foreground text-background">
          <p className="whitespace-pre-wrap text-sm">{text}</p>
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
        <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
          AI
        </div>
        <div className="flex flex-col gap-0.5 max-w-[80%]">
          <TextBlock text={text} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 w-full flex-row">
      <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
        AI
      </div>
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

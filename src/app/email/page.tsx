"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  SentIcon,
  RefreshIcon,
  Mail01Icon,
  MailOpenIcon,
  AlertCircleIcon,
  Loading03Icon,
  PlusSignIcon,
  MailReply01Icon,
  Calendar03Icon,
  ArrowLeft01Icon,
  SparklesIcon,
  InboxIcon,
  MessageAdd01Icon,
} from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatFrom(from: string): string {
  const match = from.match(/^(.+?)\s*</);
  return match ? match[1].replace(/"/g, "").trim() : from.split("@")[0];
}

function getInitial(from: string): string {
  const name = formatFrom(from);
  return name.charAt(0).toUpperCase();
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function extractEmailAddress(from: string): string {
  const match = from.match(/<(.+?)>/);
  return match ? match[1] : from;
}

function stripEmailContext(text: string): string {
  return text.replace(/\n\n\[Selected email — .+?\]$/, "").trim();
}

// ── Inbox Panel ──────────────────────────────────────────────────────────────

function InboxPanel({
  selectedId,
  selectedEmail,
  onSelectEmail,
  onAskAI,
}: {
  selectedId: string | null;
  selectedEmail: EmailSummary | null;
  onSelectEmail: (email: EmailSummary) => void;
  onAskAI: (msg: string) => void;
}) {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchEmails() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/email?max=20");
      const data = (await res.json()) as {
        emails?: EmailSummary[];
        connected?: boolean;
        error?: string;
      };
      setConnected(data.connected ?? true);
      if (data.error && !data.emails) {
        setError(data.error);
      } else {
        setEmails(data.emails ?? []);
      }
    } catch {
      setError("Could not load emails");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchEmails();
  }, []);

  const unreadCount = emails.filter((e) => e.isUnread).length;

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 px-8 text-center">
        <div className="size-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <AlertCircleIcon className="size-8 text-gray-300" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Gmail not connected</p>
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
            Connect your Google account to view and manage your emails here.
          </p>
        </div>
        <a
          href="/settings"
          className="text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-sm"
        >
          Connect in Settings
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Inbox
          </span>
          {unreadCount > 0 && (
            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={() => void fetchEmails()}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
        >
          <RefreshIcon className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 && (
          <div className="px-4 py-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 animate-pulse">
                <div className="size-9 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2 py-0.5">
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-2.5 bg-gray-50 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
              <AlertCircleIcon className="size-3.5 shrink-0" />
              <span className="text-xs">{error}</span>
            </div>
          </div>
        )}

        <div>
          {emails.map((email) => {
            const isActive = selectedId === email.id;
            return (
              <button
                key={email.id}
                onClick={() => onSelectEmail(email)}
                className={cn(
                  "w-full text-left px-4 py-3.5 transition-all group",
                  isActive
                    ? "bg-blue-50/60 border-l-2 border-l-blue-500"
                    : "border-l-2 border-l-transparent hover:bg-gray-50/80",
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "size-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-colors",
                      email.isUnread
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-400",
                    )}
                  >
                    {getInitial(email.from)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span
                        className={cn(
                          "text-sm truncate",
                          email.isUnread ? "font-semibold text-gray-900" : "text-gray-600",
                        )}
                      >
                        {formatFrom(email.from)}
                      </span>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {formatDate(email.date)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[13px] truncate mb-0.5",
                        email.isUnread ? "font-medium text-gray-800" : "text-gray-500",
                      )}
                    >
                      {email.subject || "(no subject)"}
                    </p>
                    <p className="text-xs text-gray-400 truncate leading-relaxed">
                      {email.snippet}
                    </p>
                  </div>

                  {email.isUnread && (
                    <div className="size-2 rounded-full bg-blue-500 shrink-0 mt-2.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!loading && !error && emails.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <MailOpenIcon className="size-6 text-gray-200" />
            <p className="text-xs text-gray-400">Your inbox is empty</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-3 shrink-0 flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50/30">
        {selectedEmail && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onAskAI(
                `Draft a reply to this email. Check my calendar availability first if scheduling is involved, then write a professional reply.\n\nEmail ID: ${selectedEmail.id}\nFrom: ${selectedEmail.from}\nSubject: ${selectedEmail.subject || "(no subject)"}`,
              )
            }
            className="w-full justify-start text-xs gap-2 text-violet-600 border-violet-200 bg-violet-50/50 hover:bg-violet-100/60 transition-colors"
          >
            <MailReply01Icon className="size-3.5 shrink-0" />
            Draft reply with AI
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAskAI("What are my most important unread emails?")}
          className="w-full justify-start text-xs gap-2 hover:bg-gray-100/60 transition-colors"
        >
          <SparklesIcon className="size-3.5 shrink-0" />
          Ask AI about inbox
        </Button>
      </div>
    </div>
  );
}

// ── Tool Badge ───────────────────────────────────────────────────────────────

function ToolBadge({ name, done }: { name: string; done: boolean }) {
  const labels: Record<string, string> = {
    list_emails: "Listing emails",
    search_emails: "Searching emails",
    get_email: "Reading email",
    create_task: "Creating task",
    check_calendar_availability: "Checking calendar",
    create_draft_reply: "Saving draft to Gmail",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium my-0.5 w-fit border transition-colors",
        done
          ? "bg-emerald-50 border-emerald-100 text-emerald-600"
          : "bg-amber-50 border-amber-100 text-amber-600",
      )}
    >
      {done ? (
        <span className="size-3 flex items-center justify-center text-emerald-500">&#10003;</span>
      ) : (
        <Loading03Icon className="size-3 animate-spin" />
      )}
      {labels[name] ?? name}
    </div>
  );
}

// ── Selected Email Preview ───────────────────────────────────────────────────

function SelectedEmailBanner({
  email,
  onClear,
}: {
  email: EmailSummary;
  onClear: () => void;
}) {
  return (
    <div className="mx-4 mt-3 mb-1 px-3.5 py-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-center gap-3 animate-fade-in">
      <div
        className={cn(
          "size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
          email.isUnread ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500",
        )}
      >
        {getInitial(email.from)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-800 truncate">
            {formatFrom(email.from)}
          </span>
          <span className="text-[10px] text-gray-400">{extractEmailAddress(email.from)}</span>
        </div>
        <p className="text-xs text-gray-500 truncate">{email.subject || "(no subject)"}</p>
      </div>
      <button
        onClick={onClear}
        className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-blue-100/50 transition-colors shrink-0"
        title="Deselect email"
      >
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({
  pendingMessage,
  onPendingConsumed,
  selectedEmail,
  onClearSelection,
  onShowInbox,
}: {
  pendingMessage: string | null;
  onPendingConsumed: () => void;
  selectedEmail: EmailSummary | null;
  onClearSelection: () => void;
  onShowInbox: () => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);
  // Generate a stable session UUID for this component instance.
  // When the parent remounts ChatPanel (via key change), a fresh UUID is created.
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/email/chat",
      body: () => ({ sessionId: sessionIdRef.current }),
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (pendingMessage && !sentRef.current) {
      sentRef.current = true;
      sendMessage({ text: pendingMessage });
      onPendingConsumed();
      setTimeout(() => {
        sentRef.current = false;
      }, 300);
    }
  }, [pendingMessage, sendMessage, onPendingConsumed]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    const full = selectedEmail
      ? `${text}\n\n[Selected email — From: ${selectedEmail.from} | Subject: ${selectedEmail.subject || "(no subject)"} | ID: ${selectedEmail.id}]`
      : text;
    sendMessage({ text: full });
  }

  const quickPrompts = selectedEmail
    ? [
        `What does this email from ${formatFrom(selectedEmail.from)} say?`,
        "Summarise this email in 2 sentences",
        "What action do I need to take?",
      ]
    : [
        "Summarize my unread emails",
        "Any emails from my team today?",
        "Find emails about invoices",
      ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-5 py-3.5 shrink-0 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          <button
            onClick={onShowInbox}
            className="md:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft01Icon className="size-4" />
          </button>
          <div className="size-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Mail01Icon className="size-3.5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-gray-800">Email AI</span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {selectedEmail
                ? `Viewing: ${selectedEmail.subject || "(no subject)"}`
                : "Ask me anything about your inbox"}
            </p>
          </div>
          {messages.length > 0 && (
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {messages.length} msg{messages.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Selected email banner */}
      {selectedEmail && <SelectedEmailBanner email={selectedEmail} onClear={onClearSelection} />}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-4 pt-12 items-center animate-fade-in">
            <div className="size-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              <Mail01Icon className="size-7 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">
                {selectedEmail ? "Ask about the selected email" : "Ask about your emails"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                I can read, search, draft replies, and check your calendar.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2 w-full max-w-sm">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    const full = selectedEmail
                      ? `${s}\n\n[Selected email — From: ${selectedEmail.from} | Subject: ${selectedEmail.subject || "(no subject)"} | ID: ${selectedEmail.id}]`
                      : s;
                    sendMessage({ text: full });
                  }}
                  className="text-left text-xs text-gray-500 px-4 py-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm transition-all group"
                >
                  <span className="group-hover:text-gray-700 transition-colors">{s}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.role === "user") {
            const text = msg.parts
              ? (msg.parts as Array<{ type: string; text?: string }>)
                  .filter((p) => p.type === "text")
                  .map((p) => p.text ?? "")
                  .join("")
              : "";
            if (!text) return null;
            const displayText = stripEmailContext(text);
            return (
              <div key={msg.id} className="flex justify-end animate-slide-up-fade">
                <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gray-900 text-white text-sm leading-relaxed shadow-sm">
                  {displayText}
                </div>
              </div>
            );
          }

          if (msg.role === "assistant") {
            const parts = (msg.parts ?? []) as Array<{
              type: string;
              text?: string;
              toolInvocation?: { toolName: string; state: string };
            }>;

            const hasContent = parts.some(
              (p) => (p.type === "text" && p.text?.trim()) || p.type === "tool-invocation",
            );
            if (!hasContent) return null;

            return (
              <div key={msg.id} className="flex gap-3 animate-slide-up-fade">
                <div className="size-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <span className="text-[10px] font-bold text-gray-500">AI</span>
                </div>
                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                  {parts.map((p, i) => {
                    if (p.type === "text" && p.text?.trim()) {
                      return (
                        <div
                          key={i}
                          className="max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-gray-100 text-gray-800 text-sm leading-relaxed shadow-sm whitespace-pre-wrap"
                        >
                          {p.text}
                        </div>
                      );
                    }
                    if (p.type === "tool-invocation" && p.toolInvocation) {
                      const { toolName, state, result } = p.toolInvocation as {
                        toolName: string;
                        state: string;
                        result?: Record<string, unknown>;
                      };
                      const isDone = state === "result";

                      if (isDone && toolName === "create_draft_reply" && result?.success) {
                        return (
                          <div key={i} className="flex flex-col gap-1.5">
                            <ToolBadge name={toolName} done={isDone} />
                            <div className="rounded-xl p-4 bg-violet-50/60 border border-violet-100 shadow-sm">
                              <div className="flex items-center gap-2 mb-2.5">
                                <MailReply01Icon className="size-3.5 shrink-0 text-violet-500" />
                                <span className="text-xs font-semibold text-violet-600">
                                  Draft saved to Gmail
                                </span>
                              </div>
                              <div className="space-y-1 mb-3">
                                <p className="text-xs text-gray-500">
                                  <span className="font-medium text-gray-600">To:</span>{" "}
                                  {String(result.to ?? "")}
                                </p>
                                <p className="text-xs text-gray-500">
                                  <span className="font-medium text-gray-600">Subject:</span>{" "}
                                  {String(result.subject ?? "")}
                                </p>
                              </div>
                              <div className="border-t border-violet-100 pt-2.5">
                                <p className="text-sm text-gray-600 leading-relaxed">
                                  {String(result.preview ?? "")}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (
                        isDone &&
                        toolName === "check_calendar_availability" &&
                        result &&
                        !result.error
                      ) {
                        const windows = (result.freeWindows as string[]) ?? [];
                        return (
                          <div key={i} className="flex flex-col gap-1.5">
                            <ToolBadge name={toolName} done={isDone} />
                            {windows.length > 0 && (
                              <div className="rounded-xl p-4 bg-cyan-50/60 border border-cyan-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-2.5">
                                  <Calendar03Icon className="size-3.5 shrink-0 text-cyan-500" />
                                  <span className="text-xs font-semibold text-cyan-600">
                                    Availability — {String(result.range ?? "")}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {windows.map((w, wi) => (
                                    <p key={wi} className="text-xs text-gray-500 leading-relaxed">
                                      {w}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return <ToolBadge key={i} name={toolName} done={isDone} />;
                    }
                    return null;
                  })}
                </div>
              </div>
            );
          }

          return null;
        })}

        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="size-7 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-[10px] font-bold text-gray-500">AI</span>
            </div>
            <div className="bg-white border border-gray-100 text-gray-400 text-sm px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-1" />
                <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-2" />
                <span className="size-1.5 rounded-full bg-gray-400 animate-bounce-dot stagger-3" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 shrink-0 flex gap-2.5 items-end border-t border-gray-100 bg-white/80 backdrop-blur-sm"
      >
        <div
          className={cn(
            "flex-1 flex items-end rounded-xl border bg-white transition-all overflow-hidden",
            input
              ? "border-gray-300 shadow-sm ring-1 ring-gray-100"
              : "border-gray-200 hover:border-gray-300",
          )}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.closest("form");
                if (form) form.requestSubmit();
              }
            }}
            placeholder={selectedEmail ? "Ask about this email..." : "Ask about your emails..."}
            rows={1}
            className="flex-1 resize-none px-3.5 py-2.5 text-sm text-gray-900 bg-transparent focus:outline-none placeholder:text-gray-400"
            style={{ minHeight: "38px", maxHeight: "120px" }}
          />
        </div>
        <Button
          variant="default"
          size="icon"
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="shrink-0 size-9 rounded-xl disabled:opacity-30 shadow-sm"
        >
          <SentIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EmailPage() {
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"inbox" | "chat">("inbox");
  const [chatKey, setChatKey] = useState(0);

  function handleSelectEmail(email: EmailSummary) {
    setSelectedEmail(email);
    setMobileView("chat");
  }

  function handleNewSession() {
    setSelectedEmail(null);
    setChatKey((k) => k + 1);
    setMobileView("chat");
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Email</h1>
          <p className="text-sm text-gray-500 mt-1">
            Read, search, and draft replies with AI assistance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* New Session button */}
          <button
            onClick={handleNewSession}
            title="Start a new email chat session"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            <MessageAdd01Icon className="size-3.5" />
            <span className="hidden sm:inline">New session</span>
          </button>
          {/* Mobile view toggle */}
          <div className="md:hidden flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setMobileView("inbox")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileView === "inbox"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              <InboxIcon className="size-3.5" />
              Inbox
            </button>
            <button
              onClick={() => setMobileView("chat")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                mobileView === "chat"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              <SparklesIcon className="size-3.5" />
              AI Chat
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 min-h-0 mx-4 md:mx-6 mb-4 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Left — Inbox list (desktop always visible, mobile conditional) */}
        <div
          className={cn(
            "flex flex-col w-full md:w-80 shrink-0 md:border-r border-gray-100",
            mobileView === "inbox" ? "flex" : "hidden md:flex",
          )}
        >
          <InboxPanel
            selectedId={selectedEmail?.id ?? null}
            selectedEmail={selectedEmail}
            onSelectEmail={handleSelectEmail}
            onAskAI={(msg) => {
              setPendingMessage(msg);
              setMobileView("chat");
            }}
          />
        </div>

        {/* Right — AI Chat (desktop always visible, mobile conditional) */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 bg-gray-50/30",
            mobileView === "chat" ? "flex" : "hidden md:flex",
          )}
        >
          <ChatPanel
            key={chatKey}
            pendingMessage={pendingMessage}
            onPendingConsumed={() => setPendingMessage(null)}
            selectedEmail={selectedEmail}
            onClearSelection={() => setSelectedEmail(null)}
            onShowInbox={() => setMobileView("inbox")}
          />
        </div>
      </div>
    </div>
  );
}

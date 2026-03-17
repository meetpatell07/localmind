"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, RefreshCw, Mail, MailOpen, AlertCircle, Loader2, Plus, Reply, Calendar } from "lucide-react";

interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

function formatFrom(from: string): string {
  const match = from.match(/^(.+?)\s*</);
  return match ? match[1].replace(/"/g, "").trim() : from.split("@")[0];
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

// ── Inbox Panel ───────────────────────────────────────────────────────────────
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

  useEffect(() => { void fetchEmails(); }, []);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <AlertCircle className="h-8 w-8" style={{ color: "hsl(215 12% 35%)" }} />
        <p className="font-mono text-[12px]" style={{ color: "hsl(210 12% 50%)" }}>
          Gmail not connected
        </p>
        <a
          href="/settings"
          className="font-mono text-[11px] px-3 py-1.5 rounded-sm"
          style={{ background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(240,160,21,0.2)" }}
        >
          Connect in Settings →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <span className="font-mono text-[11px]" style={{ color: "hsl(210 18% 60%)" }}>INBOX</span>
        <button
          onClick={() => void fetchEmails()}
          className="p-1 rounded-sm transition-colors"
          style={{ color: "hsl(215 12% 40%)" }}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && emails.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "hsl(215 12% 35%)" }} />
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <p className="font-mono text-[11px]" style={{ color: "hsl(0 60% 50%)" }}>{error}</p>
          </div>
        )}

        {emails.map((email) => {
          const active = selectedId === email.id;
          return (
            <button
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className="w-full text-left px-4 py-3 transition-colors"
              style={{
                background: active ? "var(--amber-dim)" : "transparent",
                borderLeft: active ? "2px solid var(--amber)" : "2px solid transparent",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div className="flex items-start gap-2">
                <div className="pt-0.5 shrink-0">
                  {email.isUnread
                    ? <Mail className="h-3 w-3" style={{ color: "var(--amber)" }} />
                    : <MailOpen className="h-3 w-3" style={{ color: "hsl(215 12% 35%)" }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className="font-mono text-[11px] truncate"
                      style={{ color: email.isUnread ? "hsl(210 18% 80%)" : "hsl(210 12% 55%)" }}
                    >
                      {formatFrom(email.from)}
                    </span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: "hsl(215 12% 35%)" }}>
                      {formatDate(email.date)}
                    </span>
                  </div>
                  <p
                    className="font-mono text-[11px] truncate mb-0.5"
                    style={{ color: active ? "var(--amber)" : "hsl(210 15% 65%)" }}
                  >
                    {email.subject || "(no subject)"}
                  </p>
                  <p className="font-mono text-[10px] truncate opacity-60" style={{ color: "hsl(210 12% 50%)" }}>
                    {email.snippet}
                  </p>
                </div>
              </div>
            </button>
          );
        })}

        {!loading && !error && emails.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="font-mono text-[11px]" style={{ color: "hsl(215 12% 35%)" }}>No emails found</p>
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="px-4 py-3 shrink-0 flex flex-col gap-2" style={{ borderTop: "1px solid var(--line)" }}>
        {/* Draft reply — shown when an email is selected */}
        {selectedEmail && (
          <button
            onClick={() =>
              onAskAI(
                `Draft a reply to this email. Check my calendar availability first if scheduling is involved, then write a professional reply.\n\nEmail ID: ${selectedEmail.id}\nFrom: ${selectedEmail.from}\nSubject: ${selectedEmail.subject || "(no subject)"}`
              )
            }
            className="w-full flex items-center gap-2 px-3 py-2 rounded-sm font-mono text-[11px] transition-colors"
            style={{ background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <Reply className="h-3 w-3 shrink-0" />
            Draft reply with AI
          </button>
        )}
        <button
          onClick={() => onAskAI("What are my most important unread emails?")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-sm font-mono text-[11px] transition-colors"
          style={{ background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(240,160,21,0.15)" }}
        >
          <Plus className="h-3 w-3 shrink-0" />
          Ask AI about inbox
        </button>
      </div>
    </div>
  );
}

// ── Tool call badge ───────────────────────────────────────────────────────────
function ToolBadge({ name, done }: { name: string; done: boolean }) {
  const labels: Record<string, string> = {
    list_emails:                 "listing emails",
    search_emails:               "searching emails",
    get_email:                   "reading email",
    create_task:                 "creating task",
    check_calendar_availability: "checking calendar",
    create_draft_reply:          "saving draft to Gmail",
  };
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm font-mono text-[10px] my-0.5 w-fit"
      style={{
        background: done ? "rgba(74,222,128,0.06)" : "rgba(240,160,21,0.08)",
        border: `1px solid ${done ? "rgba(74,222,128,0.15)" : "rgba(240,160,21,0.2)"}`,
        color: done ? "#4ade80" : "var(--amber)",
      }}
    >
      {done
        ? <span className="h-2.5 w-2.5 flex items-center justify-center">✓</span>
        : <Loader2 className="h-2.5 w-2.5 animate-spin" />
      }
      {labels[name] ?? name}
    </div>
  );
}

// ── Chat Panel ─────────────────────────────────────────────────────────────────
function ChatPanel({
  pendingMessage,
  onPendingConsumed,
  selectedEmail,
}: {
  pendingMessage: string | null;
  onPendingConsumed: () => void;
  selectedEmail: EmailSummary | null;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef(false);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/email/chat" }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Only inject pending messages from explicit user actions (Draft reply, Ask AI)
  useEffect(() => {
    if (pendingMessage && !sentRef.current) {
      sentRef.current = true;
      sendMessage({ text: pendingMessage });
      onPendingConsumed();
      setTimeout(() => { sentRef.current = false; }, 300);
    }
  }, [pendingMessage, sendMessage, onPendingConsumed]);

  // Prepend email context to manual input when an email is selected
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    // Attach email ID silently so AI knows which email user is asking about
    const full = selectedEmail
      ? `${text}\n\n[Selected email — From: ${selectedEmail.from} | Subject: ${selectedEmail.subject || "(no subject)"} | ID: ${selectedEmail.id}]`
      : text;
    sendMessage({ text: full });
  }

  // Quick prompts — contextual when an email is selected
  const quickPrompts = selectedEmail
    ? [
        `What does this email from ${selectedEmail.from.split("<")[0].trim()} say?`,
        "Summarise this email in 2 sentences",
        "What action do I need to take?",
      ]
    : ["Summarize my unread emails", "Any emails from my team today?", "Find emails about invoices"];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <p className="font-mono text-[11px]" style={{ color: "hsl(210 18% 60%)" }}>EMAIL AI</p>
        {selectedEmail ? (
          <p className="font-mono text-[10px] truncate opacity-50" style={{ maxWidth: "260px" }}>
            Selected: {selectedEmail.subject || "(no subject)"}
          </p>
        ) : (
          <p className="font-mono text-[10px] opacity-40">Ask me anything about your inbox</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2 pt-8 items-center">
            <Mail className="h-8 w-8 opacity-15" style={{ color: "var(--amber)" }} />
            <p className="font-mono text-[12px] text-center opacity-30">
              {selectedEmail ? "Ask me about the selected email" : "Ask me about your emails"}
            </p>
            <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
              {quickPrompts.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    const full = selectedEmail
                      ? `${s}\n\n[Selected email — From: ${selectedEmail.from} | Subject: ${selectedEmail.subject || "(no subject)"} | ID: ${selectedEmail.id}]`
                      : s;
                    sendMessage({ text: full });
                  }}
                  className="text-left px-3 py-2 rounded-sm font-mono text-[11px] transition-colors"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", color: "hsl(210 12% 55%)" }}
                >
                  {s}
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
            return (
              <div key={msg.id} className="flex justify-end">
                <div
                  className="max-w-[75%] px-3 py-2 rounded-sm font-mono text-[12px] leading-relaxed"
                  style={{ background: "var(--amber-dim)", border: "1px solid rgba(240,160,21,0.2)", color: "hsl(40 80% 75%)" }}
                >
                  {text}
                </div>
              </div>
            );
          }

          if (msg.role === "assistant") {
            // Render parts in document order: text → tool badge → text → …
            const parts = (msg.parts ?? []) as Array<{
              type: string;
              text?: string;
              toolInvocation?: { toolName: string; state: string };
            }>;

            const hasContent = parts.some(
              (p) => (p.type === "text" && p.text?.trim()) || p.type === "tool-invocation"
            );
            if (!hasContent) return null;

            return (
              <div key={msg.id} className="flex flex-col gap-0.5">
                {parts.map((p, i) => {
                  if (p.type === "text" && p.text?.trim()) {
                    return (
                      <div
                        key={i}
                        className="max-w-[85%] px-3 py-2 rounded-sm font-mono text-[12px] leading-relaxed whitespace-pre-wrap"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)", color: "hsl(210 18% 75%)" }}
                      >
                        {p.text}
                      </div>
                    );
                  }
                  if (p.type === "tool-invocation" && p.toolInvocation) {
                    const { toolName, state, result } = p.toolInvocation as {
                      toolName: string; state: string;
                      result?: Record<string, unknown>;
                    };
                    const done = state === "result";

                    // Render draft preview card inline when draft was saved
                    if (done && toolName === "create_draft_reply" && result?.success) {
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <ToolBadge name={toolName} done={done} />
                          <div
                            className="rounded-sm p-3 font-mono text-[11px]"
                            style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Reply className="h-3 w-3 shrink-0" style={{ color: "#818cf8" }} />
                              <span style={{ color: "#818cf8" }}>Draft saved to Gmail</span>
                            </div>
                            <div className="opacity-50 text-[10px] mb-1">To: {String(result.to ?? "")}</div>
                            <div className="opacity-50 text-[10px] mb-2">Subject: {String(result.subject ?? "")}</div>
                            <p className="leading-relaxed opacity-70" style={{ color: "hsl(210 18% 75%)" }}>
                              {String(result.preview ?? "")}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    // Calendar results inline
                    if (done && toolName === "check_calendar_availability" && result && !result.error) {
                      const windows = (result.freeWindows as string[]) ?? [];
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <ToolBadge name={toolName} done={done} />
                          {windows.length > 0 && (
                            <div
                              className="rounded-sm p-3 font-mono text-[11px]"
                              style={{ background: "rgba(6,182,212,0.05)", border: "1px solid rgba(6,182,212,0.15)" }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Calendar className="h-3 w-3 shrink-0" style={{ color: "#22d3ee" }} />
                                <span style={{ color: "#22d3ee" }}>Availability — {String(result.range ?? "")}</span>
                              </div>
                              {windows.map((w, wi) => (
                                <div key={wi} className="opacity-60 text-[10px] leading-relaxed">{w}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    return <ToolBadge key={i} name={toolName} done={done} />;
                  }
                  return null;
                })}
              </div>
            );
          }

          return null;
        })}

        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" style={{ color: "hsl(215 12% 40%)" }} />
            <span className="font-mono text-[11px]" style={{ color: "hsl(215 12% 40%)" }}>thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 shrink-0 flex gap-2 items-end"
        style={{ borderTop: "1px solid var(--line)" }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={selectedEmail ? `Ask about this email…` : "Ask about your emails…"}
          rows={1}
          className="flex-1 resize-none rounded-sm px-3 py-2 font-mono text-[12px] focus:outline-none"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--line)",
            color: "hsl(210 18% 80%)",
            minHeight: "36px",
            maxHeight: "120px",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming}
          className="shrink-0 p-2 rounded-sm transition-colors disabled:opacity-30"
          style={{ background: "var(--amber-dim)", border: "1px solid rgba(240,160,21,0.2)", color: "var(--amber)" }}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmailPage() {
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  function handleSelectEmail(email: EmailSummary) {
    setSelectedEmail(email);
    // No auto-prompt — user asks about the email manually
  }

  return (
    <div className="flex h-full">
      {/* Left — Inbox list */}
      <div className="hidden md:flex flex-col w-80 shrink-0" style={{ borderRight: "1px solid var(--line)" }}>
        <InboxPanel
          selectedId={selectedEmail?.id ?? null}
          selectedEmail={selectedEmail}
          onSelectEmail={handleSelectEmail}
          onAskAI={(msg) => setPendingMessage(msg)}
        />
      </div>

      {/* Right — AI Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatPanel
          pendingMessage={pendingMessage}
          onPendingConsumed={() => setPendingMessage(null)}
          selectedEmail={selectedEmail}
        />
      </div>
    </div>
  );
}

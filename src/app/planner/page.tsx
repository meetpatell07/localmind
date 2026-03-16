"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckSquare, Plus, LayoutGrid, List, Sparkles, Wand2, AlertCircle } from "lucide-react";
import { KanbanBoard } from "@/frontend/components/planner/kanban-board";
import { TaskCard } from "@/frontend/components/planner/task-card";
import { TaskSkeleton, PlanSkeleton } from "@/frontend/components/ui/skeleton";
import type { Task, TaskStatus, TaskPriority } from "@/frontend/components/planner/task-card";

interface DailyPlan {
  summary: string;
  prioritized: Array<{
    taskId: string;
    title: string;
    reason: string;
    timeEstimate: string;
  }>;
}

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  // NL input
  const [nlInput, setNlInput] = useState("");
  const [nlParsing, setNlParsing] = useState(false);

  // AI plan
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = await res.json() as { tasks: Task[] };
      setTasks(data.tasks ?? []);
    } catch {
      setError("Could not load tasks. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          priority: newPriority,
          dueDate: newDue || undefined,
          status: "todo",
        }),
      });
      const data = await res.json() as { task: Task };
      setTasks((prev) => [data.task, ...prev]);
      setNewTitle(""); setNewDesc(""); setNewPriority("medium"); setNewDue("");
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  async function handleNLCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nlInput.trim()) return;
    setNlParsing(true);
    try {
      const res = await fetch("/api/tasks?action=nl-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: nlInput.trim() }),
      });
      const data = await res.json() as { task: Task };
      setTasks((prev) => [data.task, ...prev]);
      setNlInput("");
    } finally {
      setNlParsing(false);
    }
  }

  async function handleGeneratePlan() {
    setPlanLoading(true);
    setShowPlan(true);
    try {
      const res = await fetch("/api/tasks?action=daily-plan");
      const data = await res.json() as { plan: DailyPlan };
      setPlan(data.plan);
    } finally {
      setPlanLoading(false);
    }
  }

  const todoCnt = tasks.filter((t) => t.status === "todo").length;
  const doneCnt = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-mono text-xl tracking-wider" style={{ color: "var(--amber)" }}>
              Planner
            </h1>
            <p className="font-mono text-[10px] opacity-25 mt-1">
              {tasks.length} tasks · {todoCnt} pending · {doneCnt} done
            </p>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="font-mono text-[10px] opacity-30 animate-pulse">loading...</span>}

            {/* AI plan button */}
            <button
              onClick={handleGeneratePlan}
              disabled={planLoading}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-sm disabled:opacity-40 transition-colors"
              style={{
                background: showPlan ? "var(--amber-dim)" : "rgba(255,255,255,0.03)",
                color: showPlan ? "var(--amber)" : "hsl(215 12% 50%)",
                border: "1px solid var(--line)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {planLoading ? "planning..." : "daily plan"}
            </button>

            {/* View toggle */}
            <div className="flex items-center" style={{ border: "1px solid var(--line)", borderRadius: "3px" }}>
              <button
                onClick={() => setView("kanban")}
                className="p-1.5 transition-colors"
                style={{
                  background: view === "kanban" ? "var(--amber-dim)" : "transparent",
                  color: view === "kanban" ? "var(--amber)" : "hsl(215 12% 40%)",
                  borderRight: "1px solid var(--line)",
                }}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className="p-1.5 transition-colors"
                style={{
                  background: view === "list" ? "var(--amber-dim)" : "transparent",
                  color: view === "list" ? "var(--amber)" : "hsl(215 12% 40%)",
                }}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Add task */}
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-sm"
              style={{
                background: showAdd ? "var(--amber-dim)" : "rgba(240,160,21,0.08)",
                color: "var(--amber)",
                border: "1px solid rgba(240,160,21,0.2)",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              add task
            </button>
          </div>
        </div>

        {/* NL task input */}
        <form onSubmit={handleNLCreate} className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2"
            style={{ border: "1px solid var(--line)", borderRadius: "3px", background: "var(--surface-raised)" }}
          >
            <Wand2 className="h-3.5 w-3.5 opacity-30 shrink-0" style={{ color: "var(--amber)" }} />
            <input
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder="remind me to review PRs tomorrow morning..."
              className="flex-1 bg-transparent font-mono text-[12px] outline-none placeholder:opacity-20"
              style={{ color: "hsl(210 18% 80%)" }}
            />
          </div>
          <button
            type="submit"
            disabled={nlParsing || !nlInput.trim()}
            className="font-mono text-[11px] px-3 py-2 rounded-sm disabled:opacity-30"
            style={{ background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(240,160,21,0.2)" }}
          >
            {nlParsing ? "parsing..." : "→"}
          </button>
        </form>

        {/* Manual add form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mt-3 p-4 rounded-sm space-y-3"
            style={{ background: "var(--navy)", border: "1px solid var(--line)" }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full bg-transparent font-mono text-[13px] outline-none placeholder:opacity-20"
              style={{ color: "hsl(210 18% 85%)" }}
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full bg-transparent font-mono text-[11px] outline-none placeholder:opacity-20"
              style={{ color: "hsl(210 18% 60%)" }}
            />
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1">
                {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className="font-mono text-[9px] px-2 py-1 rounded-sm"
                    style={{
                      background: newPriority === p ? "var(--amber-dim)" : "rgba(255,255,255,0.04)",
                      color: newPriority === p ? "var(--amber)" : "hsl(215 12% 45%)",
                      border: newPriority === p ? "1px solid rgba(240,160,21,0.3)" : "1px solid var(--line)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="bg-transparent font-mono text-[10px] outline-none opacity-40 focus:opacity-80"
                style={{ color: "hsl(210 18% 70%)" }}
              />
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setShowAdd(false)} className="font-mono text-[10px] opacity-30 hover:opacity-60">cancel</button>
                <button
                  type="submit"
                  disabled={adding || !newTitle.trim()}
                  className="font-mono text-[11px] px-3 py-1 rounded-sm disabled:opacity-30"
                  style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
                >
                  {adding ? "adding..." : "add →"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Error state */}
        {error && (
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-sm font-mono text-[12px]"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "rgba(248,113,113,0.8)" }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={load} className="ml-auto opacity-60 hover:opacity-100">retry →</button>
          </div>
        )}

        {/* AI Plan panel */}
        {showPlan && (
          <div
            className="rounded-sm overflow-hidden"
            style={{ border: "1px solid var(--line)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--line)" }}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
                <span className="font-mono text-[11px] tracking-widest uppercase opacity-60">Today&apos;s Focus</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGeneratePlan}
                  disabled={planLoading}
                  className="font-mono text-[10px] opacity-30 hover:opacity-70 disabled:opacity-20"
                >
                  {planLoading ? "..." : "refresh"}
                </button>
                <button onClick={() => setShowPlan(false)} className="font-mono text-[10px] opacity-20 hover:opacity-50">✕</button>
              </div>
            </div>
            <div className="px-4 py-3" style={{ background: "var(--navy)" }}>
              {planLoading ? (
                <PlanSkeleton />
              ) : plan ? (
                <div className="space-y-3">
                  <p className="font-mono text-[11px] opacity-50 italic">{plan.summary}</p>
                  {plan.prioritized.map((item, i) => (
                    <div key={item.taskId} className="flex items-start gap-3">
                      <span className="font-mono text-[9px] opacity-20 mt-0.5 w-4 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[12px]" style={{ color: "hsl(210 18% 82%)" }}>{item.title}</p>
                        <p className="font-mono text-[10px] opacity-35 mt-0.5">{item.reason}</p>
                      </div>
                      <span
                        className="font-mono text-[10px] shrink-0"
                        style={{ color: "var(--amber)", opacity: 0.6 }}
                      >
                        {item.timeEstimate}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Tasks */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <TaskSkeleton key={i} />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <CheckSquare className="h-8 w-8 opacity-10" />
            <p className="font-mono text-[11px] opacity-25">no tasks yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="font-mono text-[11px] opacity-40 hover:opacity-70"
              style={{ color: "var(--amber)" }}
            >
              add your first task →
            </button>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard tasks={tasks} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

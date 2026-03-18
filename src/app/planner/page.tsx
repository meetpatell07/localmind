"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckmarkSquare01Icon, PlusSignIcon, GridViewIcon, LeftToRightListDashIcon, SparklesIcon, MagicWand01Icon, AlertCircleIcon, Cancel01Icon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanBoard } from "@/components/planner/kanban-board";
import { TaskCard } from "@/components/planner/task-card";
import { TaskSkeleton, PlanSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/components/planner/task-card";

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
  const inProgressCnt = tasks.filter((t) => t.status === "in_progress").length;
  const doneCnt = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-4 shrink-0 border-b border-gray-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Planner</h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-gray-400" />
                <span className="text-xs text-gray-500">{todoCnt} to do</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-500">{inProgressCnt} active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-gray-500">{doneCnt} done</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loading && <span className="text-xs font-medium text-gray-400 animate-pulse">Loading...</span>}

            {/* AI plan button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeneratePlan}
              disabled={planLoading}
              className={cn(
                "text-xs transition-all gap-1.5",
                showPlan
                  ? "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100"
                  : "hover:bg-gray-50"
              )}
            >
              <SparklesIcon className={cn("size-3.5", showPlan ? "text-violet-500" : "text-gray-400")} />
              {planLoading ? "Planning..." : "Daily plan"}
            </Button>

            {/* View toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors border-r border-gray-200",
                  view === "kanban"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <GridViewIcon className="size-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  view === "list"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                )}
              >
                <LeftToRightListDashIcon className="size-3.5" />
              </button>
            </div>

            {/* Add task */}
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowAdd((v) => !v)}
              className={cn(
                "text-xs gap-1.5 transition-all",
                showAdd
                  ? "bg-gray-900 text-white"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              )}
            >
              <PlusSignIcon className="size-3.5" />
              Add task
            </Button>
          </div>
        </div>

        {/* NL task input */}
        <form onSubmit={handleNLCreate} className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-2.5 flex-1 px-3.5 py-2.5 rounded-xl border bg-white transition-all",
            nlInput
              ? "border-gray-300 shadow-sm ring-1 ring-gray-100"
              : "border-gray-200 hover:border-gray-300"
          )}>
            <MagicWand01Icon className={cn(
              "size-4 shrink-0 transition-colors",
              nlInput ? "text-violet-400" : "text-gray-300",
            )} />
            <Input
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder="Describe a task naturally... e.g. &quot;Review PRs tomorrow morning&quot;"
              className="flex-1 bg-transparent border-none h-auto p-0 text-sm text-gray-900 focus-visible:ring-0 placeholder:text-gray-400"
            />
          </div>
          <Button
            variant={nlInput.trim() ? "default" : "outline"}
            size="sm"
            type="submit"
            disabled={nlParsing || !nlInput.trim()}
            className="text-xs rounded-xl transition-all"
          >
            {nlParsing ? "Parsing..." : "Create"}
          </Button>
        </form>

        {/* Manual add form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mt-3 p-4 rounded-xl space-y-3 border border-gray-200 bg-white shadow-sm animate-slide-up-fade"
          >
            <Input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full bg-transparent border-none h-auto p-0 text-sm text-gray-900 font-medium focus-visible:ring-0 placeholder:text-gray-400"
            />
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full bg-transparent border-none h-auto p-0 text-sm text-gray-500 focus-visible:ring-0 placeholder:text-gray-400"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5">
                {(["low", "medium", "high"] as TaskPriority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setNewPriority(p)}
                    className={cn(
                      "text-xs capitalize px-2.5 py-1 rounded-md transition-all font-medium",
                      newPriority === p
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Input
                type="date"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
                className="bg-transparent border-gray-200 h-7 text-xs text-gray-500 w-auto focus-visible:ring-gray-200 rounded-lg"
              />
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-700">
                  Cancel
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  type="submit"
                  disabled={adding || !newTitle.trim()}
                  className="text-xs"
                >
                  {adding ? "Adding..." : "Add task"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm bg-red-50 border border-red-100 text-red-600 animate-slide-up-fade">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={load} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50">
              Retry
            </Button>
          </div>
        )}

        {/* AI Plan panel */}
        {showPlan && (
          <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white shadow-sm overflow-hidden animate-slide-up-fade">
            <div className="flex items-center justify-between px-4 py-3 border-b border-violet-100/50">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-lg bg-violet-100 flex items-center justify-center">
                  <SparklesIcon className="size-3.5 text-violet-500" />
                </div>
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Today&apos;s Focus</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePlan}
                  disabled={planLoading}
                  className="text-xs text-violet-400 hover:text-violet-600 hover:bg-violet-50"
                >
                  {planLoading ? "..." : "Refresh"}
                </Button>
                <button
                  onClick={() => setShowPlan(false)}
                  className="p-1 rounded-md text-violet-300 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                >
                  <Cancel01Icon className="size-3.5" />
                </button>
              </div>
            </div>
            <div className="px-4 py-3">
              {planLoading ? (
                <PlanSkeleton />
              ) : plan ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 italic leading-relaxed">{plan.summary}</p>
                  <div className="space-y-2">
                    {plan.prioritized.map((item, i) => (
                      <div key={item.taskId} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-violet-50/50 transition-colors">
                        <span className="text-[10px] font-bold text-violet-400 bg-violet-100 px-1.5 py-0.5 rounded mt-0.5 shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{item.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{item.reason}</p>
                        </div>
                        <span className="text-[10px] font-medium text-violet-500 bg-violet-100/50 px-2 py-0.5 rounded-md shrink-0 mt-0.5">
                          {item.timeEstimate}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Tasks */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((col) => (
              <div key={col} className="space-y-2">
                <div className="h-5 mb-2" />
                {[1, 2].map((i) => <TaskSkeleton key={i} />)}
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="size-14 rounded-2xl bg-gray-50 flex items-center justify-center">
              <CheckmarkSquare01Icon className="size-7 text-gray-300" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">No tasks yet</p>
              <p className="text-xs text-gray-400 mt-1">Create your first task to get started</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdd(true)}
              className="text-xs gap-1.5"
            >
              <PlusSignIcon className="size-3.5" />
              Add your first task
            </Button>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard tasks={tasks} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : (
          <div className="space-y-1.5 max-w-2xl">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

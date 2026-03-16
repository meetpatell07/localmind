"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckSquare, Plus, LayoutGrid, List } from "lucide-react";
import { KanbanBoard } from "@/frontend/components/planner/kanban-board";
import { TaskCard } from "@/frontend/components/planner/task-card";
import type { Task, TaskStatus, TaskPriority } from "@/frontend/components/planner/task-card";

export default function PlannerPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [newDue, setNewDue] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json() as { tasks: Task[] };
      setTasks(data.tasks ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(id: string, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    );
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
      setNewTitle("");
      setNewDesc("");
      setNewPriority("medium");
      setNewDue("");
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  const todoCnt = tasks.filter((t) => t.status === "todo").length;
  const doneCnt = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display italic text-2xl leading-none" style={{ color: "var(--amber)" }}>
              Planner
            </h1>
            <p className="font-mono text-[10px] opacity-25 mt-1">
              {tasks.length} tasks · {todoCnt} pending · {doneCnt} done
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading && <span className="font-mono text-[10px] opacity-30 animate-pulse">loading...</span>}
            {/* View toggle */}
            <div
              className="flex items-center"
              style={{ border: "1px solid var(--line)", borderRadius: "3px" }}
            >
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
            {/* Add task button */}
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-sm transition-colors"
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

        {/* Add task form */}
        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="mt-4 p-4 rounded-sm space-y-3"
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
                    className="font-mono text-[9px] px-2 py-1 rounded-sm transition-colors"
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
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="font-mono text-[10px] opacity-30 hover:opacity-60 transition-opacity"
                >
                  cancel
                </button>
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
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tasks.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <CheckSquare className="h-8 w-8 opacity-10" />
            <p className="font-mono text-[11px] opacity-25">no tasks yet</p>
            <button
              onClick={() => setShowAdd(true)}
              className="font-mono text-[11px] opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: "var(--amber)" }}
            >
              add your first task →
            </button>
          </div>
        ) : view === "kanban" ? (
          <KanbanBoard
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

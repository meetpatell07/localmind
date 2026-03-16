"use client";

import { Trash2, Circle, CheckCircle2, Clock, ArrowRight } from "lucide-react";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority | null;
  dueDate: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskCardProps {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high:   "rgba(248, 113, 113, 0.8)",
  medium: "rgba(240, 160, 21, 0.7)",
  low:    "rgba(148, 163, 184, 0.5)",
};

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  todo:        "in_progress",
  in_progress: "done",
  done:        "todo",
  cancelled:   "todo",
};

export function TaskCard({ task, onStatusChange, onDelete }: TaskCardProps) {
  const priorityColor = PRIORITY_COLORS[task.priority ?? "medium"] ?? PRIORITY_COLORS.medium;
  const isDone = task.status === "done";

  return (
    <div
      className="rounded-sm px-3 py-2.5 group transition-all"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--line)",
        opacity: isDone ? 0.45 : 1,
      }}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={() => onStatusChange(task.id, STATUS_NEXT[task.status])}
          className="mt-0.5 shrink-0 opacity-50 hover:opacity-100 transition-opacity"
          title={`Mark as ${STATUS_NEXT[task.status]}`}
        >
          {isDone
            ? <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
            : task.status === "in_progress"
            ? <Clock className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
            : <Circle className="h-3.5 w-3.5" style={{ color: "hsl(215 12% 45%)" }} />
          }
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className="font-mono text-[12px] leading-snug"
            style={{
              color: isDone ? "hsl(215 12% 40%)" : "hsl(210 18% 82%)",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="font-mono text-[10px] mt-0.5 opacity-30 truncate">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.priority && (
              <span
                className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm"
                style={{
                  background: `${priorityColor.replace(/0\.\d+\)/, "0.1)")}`,
                  color: priorityColor,
                  border: `1px solid ${priorityColor.replace(/0\.\d+\)/, "0.2)")}`,
                }}
              >
                {task.priority}
              </span>
            )}
            {task.dueDate && (
              <span className="font-mono text-[9px] opacity-30 flex items-center gap-1">
                <ArrowRight className="h-2.5 w-2.5" />
                {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
              </span>
            )}
            {(task.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="font-mono text-[9px] px-1 py-0.5 rounded-sm"
                style={{ background: "rgba(255,255,255,0.04)", color: "hsl(215 12% 45%)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 opacity-0 group-hover:opacity-30 hover:!opacity-70 transition-opacity"
        >
          <Trash2 className="h-3 w-3" style={{ color: "rgba(248,113,113,0.8)" }} />
        </button>
      </div>
    </div>
  );
}

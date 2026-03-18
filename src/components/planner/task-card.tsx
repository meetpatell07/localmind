"use client";

import { Button } from "@/components/ui/button";
import { Delete02Icon, CircleIcon, CheckmarkCircle02Icon, Clock01Icon, ArrowRight01Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";

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
  isDragging?: boolean;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: "bg-red-50", text: "text-red-600", border: "border-red-100" },
  medium: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  low:    { bg: "bg-slate-50", text: "text-slate-500", border: "border-slate-200" },
};

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  todo:        "in_progress",
  in_progress: "done",
  done:        "todo",
  cancelled:   "todo",
};

export function TaskCard({ task, onStatusChange, onDelete, isDragging }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority ?? "medium"] ?? PRIORITY_CONFIG.medium;
  const isDone = task.status === "done";

  const isOverdue = task.dueDate && !isDone && new Date(task.dueDate) < new Date();

  return (
    <div
      className={cn(
        "rounded-lg px-3.5 py-3 group transition-all bg-white border shadow-sm",
        isDragging
          ? "border-blue-200 shadow-lg shadow-blue-100/50 ring-2 ring-blue-100 rotate-[1.5deg] scale-[1.02]"
          : "border-gray-100 hover:border-gray-200 hover:shadow-md",
        isDone && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Status toggle */}
        <button
          onClick={() => onStatusChange(task.id, STATUS_NEXT[task.status])}
          className={cn(
            "mt-0.5 shrink-0 transition-colors",
            isDone
              ? "text-emerald-500 hover:text-emerald-600"
              : task.status === "in_progress"
              ? "text-blue-500 hover:text-blue-600"
              : "text-gray-300 hover:text-gray-400",
          )}
          title={`Mark as ${STATUS_NEXT[task.status].replace("_", " ")}`}
        >
          {isDone ? (
            <CheckmarkCircle02Icon className="size-4" />
          ) : task.status === "in_progress" ? (
            <Clock01Icon className="size-4" />
          ) : (
            <CircleIcon className="size-4" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium leading-snug",
              isDone ? "text-gray-400 line-through" : "text-gray-800",
            )}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {task.description}
            </p>
          )}

          {/* Meta row */}
          {(task.priority || task.dueDate || (task.tags ?? []).length > 0) && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {task.priority && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-md border capitalize",
                    priority.bg, priority.text, priority.border,
                  )}
                >
                  {task.priority}
                </span>
              )}
              {task.dueDate && (
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-1",
                    isOverdue
                      ? "text-red-600 bg-red-50 border border-red-100"
                      : "text-gray-500 bg-gray-50 border border-gray-100",
                  )}
                >
                  <ArrowRight01Icon className="size-2.5" />
                  {new Date(task.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}
                </span>
              )}
              {(task.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500 border border-gray-100"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(task.id)}
          className="shrink-0 size-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 hover:bg-red-50"
        >
          <Delete02Icon className="size-3" />
        </Button>
      </div>
    </div>
  );
}

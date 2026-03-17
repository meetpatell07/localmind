"use client";

import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "./task-card";

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const COLUMNS: { key: TaskStatus; label: string; num: string }[] = [
  { key: "todo",        label: "To Do",       num: "01" },
  { key: "in_progress", label: "In Progress",  num: "02" },
  { key: "done",        label: "Done",         num: "03" },
];

export function KanbanBoard({ tasks, onStatusChange, onDelete }: KanbanBoardProps) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-2">
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-2 py-1.5"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <span className="text-sm opacity-20">{col.num}</span>
              <span className="text-sm tracking-widest uppercase opacity-50">
                {col.label}
              </span>
              {colTasks.length > 0 && (
                <span
                  className="ml-auto text-sm px-1.5 py-0.5 rounded-sm"
                  style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
                >
                  {colTasks.length}
                </span>
              )}
            </div>

            {/* Tasks */}
            <div className="flex flex-col gap-1.5">
              {colTasks.length === 0 ? (
                <div
                  className="py-6 text-center rounded-sm"
                  style={{ border: "1px dashed var(--line)" }}
                >
                  <p className="text-sm opacity-20">empty</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

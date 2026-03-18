"use client";

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "./task-card";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const COLUMNS: { key: TaskStatus; label: string; dot: string; activeBg: string }[] = [
  { key: "todo",        label: "To Do",        dot: "bg-gray-400",    activeBg: "bg-gray-50" },
  { key: "in_progress", label: "In Progress",   dot: "bg-blue-500",   activeBg: "bg-blue-50/50" },
  { key: "done",        label: "Done",          dot: "bg-emerald-500", activeBg: "bg-emerald-50/50" },
];

export function KanbanBoard({ tasks, onStatusChange, onDelete }: KanbanBoardProps) {
  function handleDragEnd(result: DropResult) {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as TaskStatus;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task || task.status === newStatus) return;
    onStatusChange(draggableId, newStatus);
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="flex flex-col min-h-0">
              {/* Column header */}
              <div className="flex items-center gap-2.5 px-1 pb-3 mb-1">
                <div className={cn("size-2 rounded-full", col.dot)} />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {col.label}
                </span>
                <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md ml-auto">
                  {colTasks.length}
                </span>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-1 flex flex-col gap-2 rounded-xl p-2 transition-colors min-h-[120px] border-2 border-dashed",
                      snapshot.isDraggingOver
                        ? cn(col.activeBg, "border-gray-200")
                        : "border-transparent bg-gray-50/50",
                    )}
                  >
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-xs text-gray-300 select-none">
                          {col.key === "todo"
                            ? "Add a task to get started"
                            : col.key === "in_progress"
                            ? "Drag tasks here"
                            : "Completed tasks appear here"}
                        </p>
                      </div>
                    )}
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                          >
                            <TaskCard
                              task={task}
                              onStatusChange={onStatusChange}
                              onDelete={onDelete}
                              isDragging={dragSnapshot.isDragging}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

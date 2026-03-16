import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  tags?: string[];
}

export async function createTask(input: CreateTaskInput) {
  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate,
      tags: input.tags ?? [],
    })
    .returning();
  return task;
}

export async function listTasks(status?: TaskStatus) {
  if (status) {
    return db
      .select()
      .from(tasks)
      .where(eq(tasks.status, status))
      .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
  }
  return db
    .select()
    .from(tasks)
    .orderBy(asc(tasks.dueDate), desc(tasks.createdAt));
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "done") updates.completedAt = new Date();
  }
  if (input.priority !== undefined) updates.priority = input.priority;
  if ("dueDate" in input) updates.dueDate = input.dueDate;
  if (input.tags !== undefined) updates.tags = input.tags;

  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
}

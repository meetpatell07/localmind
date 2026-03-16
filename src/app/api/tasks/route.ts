import { NextRequest } from "next/server";
import { z } from "zod";
import { createTask, listTasks, updateTask, deleteTask } from "@/planner/tasks";

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as
    | "todo"
    | "in_progress"
    | "done"
    | "cancelled"
    | null;
  const rows = await listTasks(status ?? undefined);
  return Response.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const task = await createTask(parsed.data);
  return Response.json({ task }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const task = await updateTask(id, parsed.data);
  return Response.json({ task });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  await deleteTask(id);
  return Response.json({ success: true });
}

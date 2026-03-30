export const runtime = 'edge';
import { NextRequest } from "next/server";
import { z } from "zod";
import { createTask, listTasks, updateTask, deleteTask } from "@/planner/tasks";
import { generateDailyPlan, parseNaturalLanguageTask } from "@/planner/ai-planner";

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
  const action = req.nextUrl.searchParams.get("action");

  if (action === "daily-plan") {
    try {
      const plan = await generateDailyPlan();
      return Response.json({ plan });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  const status = req.nextUrl.searchParams.get("status") as
    | "todo"
    | "in_progress"
    | "done"
    | "cancelled"
    | null;
  const rows = await listTasks(status ?? undefined);
  return Response.json({ tasks: rows });
}

const NLParseSchema = z.object({ input: z.string().min(1) });

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Natural language parse + create
  if (action === "nl-create") {
    const parsed = NLParseSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Missing input" }, { status: 400 });
    }
    const fields = await parseNaturalLanguageTask(parsed.data.input);
    const task = await createTask({
      title: fields.title,
      priority: fields.priority,
      dueDate: fields.dueDate ? new Date(fields.dueDate) : undefined,
      tags: fields.tags,
    });
    return Response.json({ task, parsed: fields }, { status: 201 });
  }

  const validated = CreateSchema.safeParse(body);
  if (!validated.success) {
    return Response.json(
      { error: "Validation failed", details: validated.error.flatten() },
      { status: 400 }
    );
  }

  const task = await createTask(validated.data);
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

import { generateText } from "ai";
import { extractionModel } from "@/agent/ollama";
import { listTasks } from "./tasks";
import { getProfile } from "@/memory/profile";
import { z } from "zod";

export interface DailyPlan {
  summary: string;
  prioritized: Array<{
    taskId: string;
    title: string;
    reason: string;
    timeEstimate: string;
  }>;
  rawText: string;
}

const PlanSchema = z.object({
  summary: z.string(),
  prioritized: z.array(
    z.object({
      taskId: z.string(),
      title: z.string(),
      reason: z.string(),
      timeEstimate: z.string(),
    })
  ),
});

export async function generateDailyPlan(): Promise<DailyPlan> {
  const [activeTasks, profile] = await Promise.all([
    listTasks("todo"),
    getProfile(),
  ]);

  const inProgressTasks = await listTasks("in_progress");
  const allActive = [...inProgressTasks, ...activeTasks];

  if (allActive.length === 0) {
    return {
      summary: "No active tasks. Add some tasks to get a daily plan.",
      prioritized: [],
      rawText: "",
    };
  }

  const taskList = allActive
    .map((t) => {
      const due = t.dueDate
        ? ` | due: ${new Date(t.dueDate).toLocaleDateString()}`
        : "";
      return `- [${t.id}] (${t.priority ?? "medium"}) ${t.title}${due}${t.description ? ` — ${t.description}` : ""}`;
    })
    .join("\n");

  const profileSection = profile
    ? `User profile:\n${profile}\n\n`
    : "";

  const today = new Date().toLocaleDateString("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const prompt = `${profileSection}Today is ${today}.

Active tasks:
${taskList}

Generate a focused daily plan as JSON. Prioritize by urgency, importance, and context. Return ONLY valid JSON matching this shape:
{
  "summary": "one sentence overview of today's focus",
  "prioritized": [
    {
      "taskId": "<id from list>",
      "title": "<task title>",
      "reason": "<why this is prioritized today, max 15 words>",
      "timeEstimate": "<e.g. 30m, 1h, 2h>"
    }
  ]
}

Include at most 5 tasks. Focus on what will move the needle today.`;

  try {
    const { text } = await generateText({
      model: extractionModel,
      prompt,
      temperature: 0,
    });

    // Extract JSON from response (model may wrap in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = PlanSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) throw new Error("Schema mismatch");

    return { ...parsed.data, rawText: text };
  } catch {
    // Graceful fallback: return tasks ordered by priority without AI
    const fallback = allActive.slice(0, 5).map((t) => ({
      taskId: t.id,
      title: t.title,
      reason: "queued",
      timeEstimate: "—",
    }));

    return {
      summary: "AI plan unavailable — showing tasks by priority.",
      prioritized: fallback,
      rawText: "",
    };
  }
}

// Natural language → task fields
export interface ParsedTask {
  title: string;
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  tags?: string[];
}

export async function parseNaturalLanguageTask(input: string): Promise<ParsedTask> {
  const today = new Date().toISOString().split("T")[0];

  const prompt = `Today's date: ${today}

Parse this natural language task into JSON. Extract: title (clean, actionable), dueDate (ISO date string if mentioned), priority (low/medium/high if mentioned, else omit), tags (array of relevant tags, else omit).

Input: "${input}"

Return ONLY JSON:
{"title": "...", "dueDate": "YYYY-MM-DD", "priority": "medium", "tags": ["..."]}

Omit fields that are not mentioned. dueDate must be a real future date in YYYY-MM-DD format.`;

  const NLSchema = z.object({
    title: z.string(),
    dueDate: z.string().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    tags: z.array(z.string()).optional(),
  });

  try {
    const { text } = await generateText({
      model: extractionModel,
      prompt,
      temperature: 0,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");

    const parsed = NLSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (parsed.success) return parsed.data;
  } catch {
    // fallback
  }

  // Simple fallback: use input as title
  return { title: input };
}

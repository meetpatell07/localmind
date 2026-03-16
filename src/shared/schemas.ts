import { z } from "zod";

export const TaskCreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
});

export const TaskUpdateSchema = TaskCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const ExtractedEntitiesSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      attributes: z.record(z.unknown()).optional().default({}),
    })
  ),
  relationships: z.array(
    z.object({
      subject: z.string().min(1),
      predicate: z.string().min(1),
      object: z.string().min(1),
      confidence: z.number().min(0).max(1).optional().default(0.8),
    })
  ),
});

export const MemorySearchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(5),
});

export type TaskCreate = z.infer<typeof TaskCreateSchema>;
export type TaskUpdate = z.infer<typeof TaskUpdateSchema>;
export type ExtractedEntitiesInput = z.infer<typeof ExtractedEntitiesSchema>;

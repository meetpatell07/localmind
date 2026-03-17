import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { invalidateUserIdentityCache } from "@/memory";
import { z } from "zod";

const UpdateSchema = z.object({
  displayName:  z.string().max(200).optional(),
  email:        z.string().email().max(255).optional(),
  phone:        z.string().max(50).optional(),
  address:      z.string().optional(),
  linkedin:     z.string().max(500).optional(),
  portfolioWeb: z.string().max(500).optional(),
  instagram:    z.string().max(200).optional(),
  xHandle:      z.string().max(200).optional(),
  facebook:     z.string().max(500).optional(),
}).partial();

export async function GET(): Promise<Response> {
  try {
    const rows = await db.select().from(userProfile).limit(1);
    return Response.json({ profile: rows[0] ?? null });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const updates = { ...parsed.data, updatedAt: new Date() };

  try {
    const existing = await db.select({ id: userProfile.id }).from(userProfile).limit(1);

    if (existing[0]) {
      const [updated] = await db
        .update(userProfile)
        .set(updates)
        .returning();
      invalidateUserIdentityCache();
      return Response.json({ profile: updated });
    } else {
      const [created] = await db
        .insert(userProfile)
        .values(updates)
        .returning();
      invalidateUserIdentityCache();
      return Response.json({ profile: created });
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

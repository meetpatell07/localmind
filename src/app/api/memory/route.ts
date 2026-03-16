import { db } from "@/db";
import { entities, relationships, conversations } from "@/db/schema";
import { getProfile, rebuildProfile } from "@/memory/profile";
import { searchSimilar } from "@/memory/semantic";
import { eq, and, desc, ilike } from "drizzle-orm";

// GET /api/memory?type=profile|entities|search&q=...
export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "profile";

  if (type === "profile") {
    const profileText = await getProfile();
    return Response.json({ profile: profileText });
  }

  if (type === "entities") {
    const rows = await db
      .select()
      .from(entities)
      .orderBy(desc(entities.mentionCount))
      .limit(50);

    // Fetch active relationships for each entity
    const enriched = await Promise.all(
      rows.map(async (entity) => {
        const rels = await db
          .select({
            predicate: relationships.predicate,
            objectValue: relationships.objectValue,
            confidence: relationships.confidence,
          })
          .from(relationships)
          .where(
            and(
              eq(relationships.subjectId, entity.id),
              eq(relationships.isActive, true)
            )
          )
          .limit(5);

        return { ...entity, relationships: rels };
      })
    );

    return Response.json({ entities: enriched });
  }

  if (type === "search") {
    const query = searchParams.get("q");
    if (!query) return Response.json({ results: [] });

    const results = await searchSimilar(query, 10);
    return Response.json({ results });
  }

  if (type === "recent") {
    const rows = await db
      .select({
        role: conversations.role,
        content: conversations.content,
        createdAt: conversations.createdAt,
        channel: conversations.channel,
      })
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(20);

    return Response.json({ conversations: rows });
  }

  if (type === "entity-search") {
    const q = searchParams.get("q") ?? "";
    const rows = await db
      .select()
      .from(entities)
      .where(ilike(entities.name, `%${q}%`))
      .limit(20);
    return Response.json({ entities: rows });
  }

  return Response.json({ error: "Unknown type" }, { status: 400 });
}

// POST /api/memory/rebuild — force profile rebuild
export async function POST(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "rebuild-profile") {
    try {
      await rebuildProfile(0);
      const profile = await getProfile();
      return Response.json({ success: true, profile });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}

import { db } from "@/db";
import { entities, relationships } from "@/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import type { ExtractedEntitiesInput } from "@/shared/schemas";
import type { EntityWithRelationships } from "@/shared/types";

async function findOrCreateEntity(
  name: string,
  type: string,
  attributes: Record<string, unknown> = {}
): Promise<string> {
  // Case-insensitive dedup
  const existing = await db
    .select({ id: entities.id, mentionCount: entities.mentionCount })
    .from(entities)
    .where(ilike(entities.name, name))
    .limit(1);

  if (existing[0]) {
    await db
      .update(entities)
      .set({
        mentionCount: (existing[0].mentionCount ?? 1) + 1,
        lastSeen: new Date(),
      })
      .where(eq(entities.id, existing[0].id));
    return existing[0].id;
  }

  const [created] = await db
    .insert(entities)
    .values({ name, type, attributes })
    .returning({ id: entities.id });

  return created!.id;
}

export async function processExtractedEntities(
  extracted: ExtractedEntitiesInput
): Promise<void> {
  const entityIdMap = new Map<string, string>();

  // Create/update entities
  for (const entity of extracted.entities) {
    const id = await findOrCreateEntity(
      entity.name,
      entity.type,
      entity.attributes
    );
    entityIdMap.set(entity.name.toLowerCase(), id);
  }

  // Create relationships
  for (const rel of extracted.relationships) {
    const subjectId = entityIdMap.get(rel.subject.toLowerCase());
    if (!subjectId) continue;

    const objectEntityId = entityIdMap.get(rel.object.toLowerCase());

    // Deactivate conflicting relationships
    await db
      .update(relationships)
      .set({ isActive: false })
      .where(
        and(
          eq(relationships.subjectId, subjectId),
          eq(relationships.predicate, rel.predicate)
        )
      );

    await db.insert(relationships).values({
      subjectId,
      predicate: rel.predicate,
      objectEntityId: objectEntityId ?? null,
      objectValue: objectEntityId ? null : rel.object,
      confidence: rel.confidence ?? 0.8,
      isActive: true,
    });
  }
}

export async function getEntityContext(
  names: string[]
): Promise<EntityWithRelationships[]> {
  if (names.length === 0) return [];

  const result: EntityWithRelationships[] = [];

  for (const name of names) {
    const entityRows = await db
      .select()
      .from(entities)
      .where(ilike(entities.name, `%${name}%`))
      .limit(3);

    for (const entity of entityRows) {
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
        .limit(10);

      result.push({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        relationships: rels.map((r) => ({
          predicate: r.predicate,
          objectValue: r.objectValue,
          confidence: r.confidence ?? 0.8,
        })),
      });
    }
  }

  return result;
}

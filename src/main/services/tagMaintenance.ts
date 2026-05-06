import { asc, desc, eq, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { tags, itemTags } from '../db/schema'
import * as schema from '../db/schema'
import { getActiveProfileId } from './profileState'

type DB = BetterSQLite3Database<typeof schema>

export function cleanupUnusedTags(db: DB) {
  const activeProfileId = getActiveProfileId()
  const result = db.delete(tags)
    .where(sql`${tags.profileId} = ${activeProfileId} AND NOT EXISTS (
      SELECT 1 FROM ${itemTags}
      WHERE ${itemTags.tagId} = ${tags.id}
    )`)
    .run() as { changes?: number }

  return {
    deleted: result.changes ?? 0,
  }
}

export function getTagUsageCounts(db: DB) {
  const usageCount = sql<number>`count(${itemTags.itemId})`
  const activeProfileId = getActiveProfileId()

  return db.select({
    id: tags.id,
    name: tags.name,
    count: usageCount,
  })
    .from(tags)
    .leftJoin(itemTags, eq(tags.id, itemTags.tagId))
    .where(eq(tags.profileId, activeProfileId))
    .groupBy(tags.id, tags.name)
    .having(sql`${usageCount} > 0`)
    .orderBy(desc(usageCount), asc(tags.name))
    .all()
}

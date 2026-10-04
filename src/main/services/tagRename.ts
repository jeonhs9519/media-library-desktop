import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { itemTags, tags } from '../db/schema'

export function renameProfileTag(db: BetterSQLite3Database<typeof schema>, profileId: number, id: number, name: unknown) {
  const nextName = typeof name === 'string' ? name.trim() : ''
  if (!nextName) return { ok: false as const, reason: 'empty-name' }
  if (['미지정', 'untagged', '未指定', '未标记'].includes(nextName.toLocaleLowerCase())) {
    return { ok: false as const, reason: 'reserved-name' }
  }
  return db.transaction((tx) => {
    const source = tx.select().from(tags).where(and(eq(tags.id, id), eq(tags.profileId, profileId))).get()
    if (!source) return { ok: false as const, reason: 'not-found' }
    const duplicate = tx.select().from(tags).where(and(eq(tags.profileId, profileId), eq(tags.name, nextName))).get()
    let survivorId = id
    let removedId: number | null = null
    if (duplicate && duplicate.id !== id) {
      survivorId = Math.min(id, duplicate.id)
      removedId = Math.max(id, duplicate.id)
      const links = tx.select().from(itemTags).where(eq(itemTags.tagId, removedId)).all()
      for (const link of links) {
        tx.insert(itemTags).values({ itemId: link.itemId, tagId: survivorId }).onConflictDoNothing().run()
      }
      tx.delete(itemTags).where(eq(itemTags.tagId, removedId)).run()
      tx.delete(tags).where(and(eq(tags.id, removedId), eq(tags.profileId, profileId))).run()
    }
    tx.update(tags).set({ name: nextName }).where(and(eq(tags.id, survivorId), eq(tags.profileId, profileId))).run()
    return { ok: true as const, id: survivorId, name: nextName, removedId }
  })
}

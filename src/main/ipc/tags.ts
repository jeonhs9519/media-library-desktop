import { ipcMain } from 'electron'
import { eq, and } from 'drizzle-orm'
import { tags, itemTags } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { cleanupUnusedTags, getTagUsageCounts } from '../services/tagMaintenance'
import { getActiveProfileId } from '../services/profileState'

type DB = BetterSQLite3Database<typeof schema>

export function registerTagsIPC(db: DB) {
  ipcMain.handle('tags:getAll', async () => {
    return db.select().from(tags).where(eq(tags.profileId, getActiveProfileId())).all()
  })

  ipcMain.handle('tags:cleanupUnused', async () => {
    return cleanupUnusedTags(db)
  })

  ipcMain.handle('tags:getUsageCounts', async () => {
    cleanupUnusedTags(db)
    return getTagUsageCounts(db)
  })

  ipcMain.handle('tags:create', async (_event, { name }: { name: string }) => {
    return db.insert(tags).values({ profileId: getActiveProfileId(), name }).returning().get()
  })

  ipcMain.handle('tags:delete', async (_event, { id }: { id: number }) => {
    db.delete(tags).where(and(eq(tags.id, id), eq(tags.profileId, getActiveProfileId()))).run()
  })

  ipcMain.handle('tags:assignToItem', async (_event, { itemId, tagId }: { itemId: number; tagId: number }) => {
    db.insert(itemTags).values({ itemId, tagId }).onConflictDoNothing().run()
    return cleanupUnusedTags(db)
  })

  ipcMain.handle('tags:removeFromItem', async (_event, { itemId, tagId }: { itemId: number; tagId: number }) => {
    db.delete(itemTags).where(
      and(eq(itemTags.itemId, itemId), eq(itemTags.tagId, tagId))
    ).run()
    return cleanupUnusedTags(db)
  })
}

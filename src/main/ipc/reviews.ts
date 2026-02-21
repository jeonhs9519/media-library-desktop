import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { reviews } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

type DB = BetterSQLite3Database<typeof schema>

export function registerReviewsIPC(db: DB) {
  ipcMain.handle('reviews:upsert', async (_event, { itemId, rating, comment }: { itemId: number; rating: number; comment?: string }) => {
    const now = Date.now()
    const existing = db.select().from(reviews).where(eq(reviews.itemId, itemId)).get()

    if (existing) {
      return db.update(reviews).set({ rating, comment, updatedAt: now })
        .where(eq(reviews.itemId, itemId)).returning().get()
    } else {
      return db.insert(reviews).values({ itemId, rating, comment, createdAt: now, updatedAt: now }).returning().get()
    }
  })
}

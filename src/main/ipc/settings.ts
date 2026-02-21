import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { settings } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

type DB = BetterSQLite3Database<typeof schema>

export function registerSettingsIPC(db: DB) {
  ipcMain.handle('settings:get', async (_event, { key }: { key: string }) => {
    const row = db.select().from(settings).where(eq(settings.key, key)).get()
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', async (_event, { key, value }: { key: string; value: string }) => {
    db.insert(settings).values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run()
  })
}

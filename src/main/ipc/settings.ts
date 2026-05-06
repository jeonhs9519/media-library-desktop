import { ipcMain } from 'electron'
import { and, eq } from 'drizzle-orm'
import { settings, SYSTEM_PROFILE_ID, UNASSIGNED_PROFILE_ID } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { getActiveProfileId } from '../services/profileState'

type DB = BetterSQLite3Database<typeof schema>

const systemSettingKeys = new Set([
  'ui.language',
  'video.volume',
  'fileModifiedAt.updatePolicy',
  'profile.lastActiveId',
  'profile.lastActiveIds',
  'profile.useLastOnStartup',
])

function getSettingsProfileId(key: string) {
  return systemSettingKeys.has(key) ? SYSTEM_PROFILE_ID : getActiveProfileId()
}

export function registerSettingsIPC(db: DB) {
  ipcMain.handle('settings:get', async (_event, { key }: { key: string }) => {
    const profileId = getSettingsProfileId(key)
    const row = db.select().from(settings)
      .where(and(eq(settings.profileId, profileId), eq(settings.key, key)))
      .get()
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', async (_event, { key, value }: { key: string; value: string }) => {
    const profileId = getSettingsProfileId(key)
    db.insert(settings).values({ profileId, key, value })
      .onConflictDoUpdate({ target: [settings.profileId, settings.key], set: { value } })
      .run()
  })
}

import { ipcMain } from 'electron'
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  GUEST_PROFILE_ID,
  SYSTEM_PROFILE_ID,
  UNASSIGNED_PROFILE_ID,
  itemTags,
  items,
  playlistItems,
  playlists,
  profiles,
  reviews,
  settings,
  tags,
} from '../db/schema'
import * as schema from '../db/schema'
import { clearActiveProfileId, getActiveProfileId, hasActiveProfile, setActiveProfileId } from '../services/profileState'

type DB = BetterSQLite3Database<typeof schema>
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]

const RESERVED_PROFILE_NAMES = new Set(['UNASSIGNED', 'SYSTEM', 'GUEST'])
const MAX_PROFILE_NAME_LENGTH = 16
const LAST_ACTIVE_PROFILE_KEY = 'profile.lastActiveId'
const LAST_ACTIVE_PROFILES_KEY = 'profile.lastActiveIds'
const USE_LAST_PROFILE_ON_STARTUP_KEY = 'profile.useLastOnStartup'
const SYSTEM_SETTING_KEYS = new Set([
  'ui.language',
  'video.volume',
  'fileModifiedAt.updatePolicy',
  'profile.lastActiveId',
  'profile.lastActiveIds',
  'profile.useLastOnStartup',
])
let autoSelectSuppressed = false

function normalizeProfileName(name: string) {
  return name.trim()
}

function getVisibleProfiles(db: DB) {
  return db.select({
    id: profiles.id,
    name: profiles.name,
    createdAt: profiles.createdAt,
    updatedAt: profiles.updatedAt,
  })
    .from(profiles)
    .where(gt(profiles.id, UNASSIGNED_PROFILE_ID))
    .orderBy(asc(profiles.id))
    .all()
}

function getUnassignedCounts(db: DB) {
  return {
    items: db.select({ count: sql<number>`count(*)` }).from(items).where(eq(items.profileId, UNASSIGNED_PROFILE_ID)).get()?.count ?? 0,
    tags: db.select({ count: sql<number>`count(*)` }).from(tags).where(eq(tags.profileId, UNASSIGNED_PROFILE_ID)).get()?.count ?? 0,
    playlists: db.select({ count: sql<number>`count(*)` }).from(playlists).where(eq(playlists.profileId, UNASSIGNED_PROFILE_ID)).get()?.count ?? 0,
    settings: db.select({ count: sql<number>`count(*)` }).from(settings).where(eq(settings.profileId, UNASSIGNED_PROFILE_ID)).get()?.count ?? 0,
  }
}

function getSystemSetting(db: DB, key: string) {
  return db.select()
    .from(settings)
    .where(and(eq(settings.profileId, SYSTEM_PROFILE_ID), eq(settings.key, key)))
    .get()?.value
}

function setSystemSetting(db: DB, key: string, value: string) {
  db.insert(settings)
    .values({ profileId: SYSTEM_PROFILE_ID, key, value })
    .onConflictDoUpdate({ target: [settings.profileId, settings.key], set: { value } })
    .run()
}

function parseStoredProfileIds(value?: string | null) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id))
    }
  } catch {
    // Legacy values are handled below.
  }

  return value
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id))
}

function getProfileById(db: DB, profileId: number) {
  return db.select().from(profiles).where(eq(profiles.id, profileId)).get()
}

function getLastActiveProfileIds(db: DB) {
  const storedIds = parseStoredProfileIds(getSystemSetting(db, LAST_ACTIVE_PROFILES_KEY))
  const legacyId = Number(getSystemSetting(db, LAST_ACTIVE_PROFILE_KEY))
  const ids = Number.isInteger(legacyId) ? [...storedIds, legacyId] : storedIds

  return Array.from(new Set(ids))
    .map((id) => getProfileById(db, id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile && profile.id > UNASSIGNED_PROFILE_ID))
    .map((profile) => profile.id)
    .slice(0, 2)
}

function setLastActiveProfileIds(db: DB, profileIds: number[]) {
  const validIds = Array.from(new Set(profileIds))
    .map((id) => getProfileById(db, id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile && profile.id > UNASSIGNED_PROFILE_ID))
    .map((profile) => profile.id)
    .slice(0, 2)
  const storedIds = validIds.length > 0 ? validIds : [GUEST_PROFILE_ID]

  setSystemSetting(db, LAST_ACTIVE_PROFILES_KEY, JSON.stringify(storedIds))
  setSystemSetting(db, LAST_ACTIVE_PROFILE_KEY, String(storedIds[0]))
}

function rememberActiveProfileId(db: DB, profileId: number) {
  setLastActiveProfileIds(db, [profileId, ...getLastActiveProfileIds(db)])
}

function forgetActiveProfileId(db: DB, profileId: number) {
  setLastActiveProfileIds(db, getLastActiveProfileIds(db).filter((id) => id !== profileId))
}

function getLastActiveProfileId(db: DB) {
  return getLastActiveProfileIds(db)[0] ?? GUEST_PROFILE_ID
}

function shouldUseLastProfileOnStartup(db: DB) {
  return getSystemSetting(db, USE_LAST_PROFILE_ON_STARTUP_KEY) === 'true'
}

function getProfileStatus(db: DB) {
  if (!hasActiveProfile() && !autoSelectSuppressed && shouldUseLastProfileOnStartup(db)) {
    const lastActiveProfileId = getLastActiveProfileId(db)
    const profile = lastActiveProfileId ? getProfileById(db, lastActiveProfileId) : null
    if (profile && profile.id > UNASSIGNED_PROFILE_ID) {
      try {
        transferUnassignedData(db, profile.id)
        setActiveProfileId(profile.id)
      } catch {
        // Keep the profile selection screen available when automatic transfer cannot be completed.
      }
    }
  }

  const currentProfileId = hasActiveProfile() ? getActiveProfileId() : null
  return {
    currentProfileId,
    profiles: getVisibleProfiles(db),
    lastActiveProfileId: getLastActiveProfileId(db),
    useLastProfileOnStartup: shouldUseLastProfileOnStartup(db),
    unassignedCounts: getUnassignedCounts(db),
  }
}

function ensureProfileRows(db: DB) {
  const now = Date.now()
  db.insert(profiles)
    .values([
      { id: UNASSIGNED_PROFILE_ID, name: 'UNASSIGNED', createdAt: now, updatedAt: now },
      { id: SYSTEM_PROFILE_ID, name: 'SYSTEM', createdAt: now, updatedAt: now },
      { id: GUEST_PROFILE_ID, name: 'GUEST', createdAt: now, updatedAt: now },
    ])
    .onConflictDoNothing()
    .run()
}

function createProfile(db: DB, name: string) {
  const normalizedName = normalizeProfileName(name)
  if (!normalizedName) return { ok: false as const, reason: 'empty-name' }
  if (normalizedName.length > MAX_PROFILE_NAME_LENGTH) return { ok: false as const, reason: 'name-too-long' }
  if (RESERVED_PROFILE_NAMES.has(normalizedName.toUpperCase())) {
    return { ok: false as const, reason: 'reserved-name' }
  }

  const existing = db.select().from(profiles).where(eq(profiles.name, normalizedName)).get()
  if (existing) return { ok: false as const, reason: 'duplicate-name' }

  const now = Date.now()
  const profile = db.insert(profiles).values({
    name: normalizedName,
    createdAt: now,
    updatedAt: now,
  }).returning().get()

  return { ok: true as const, profile }
}

function renameProfile(db: DB, profileId: number, name: string) {
  const normalizedName = normalizeProfileName(name)
  if (!normalizedName) return { ok: false as const, reason: 'empty-name' }
  if (normalizedName.length > MAX_PROFILE_NAME_LENGTH) return { ok: false as const, reason: 'name-too-long' }
  if (RESERVED_PROFILE_NAMES.has(normalizedName.toUpperCase())) {
    return { ok: false as const, reason: 'reserved-name' }
  }
  if (profileId <= GUEST_PROFILE_ID) {
    return { ok: false as const, reason: 'missing-profile' }
  }

  const existing = db.select().from(profiles).where(eq(profiles.name, normalizedName)).get()
  if (existing && existing.id !== profileId) return { ok: false as const, reason: 'duplicate-name' }

  const now = Date.now()
  const profile = db.update(profiles)
    .set({ name: normalizedName, updatedAt: now })
    .where(eq(profiles.id, profileId))
    .returning()
    .get()

  if (!profile) return { ok: false as const, reason: 'missing-profile' }
  return { ok: true as const, profile }
}

function getItemCountByProfileId(db: DB, profileId: number) {
  return db.select({ count: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.profileId, profileId))
    .get()?.count ?? 0
}

function transferUnassignedData(db: DB, targetProfileId: number) {
  const now = Date.now()

  db.transaction((tx) => {
    const unassignedSettings = tx.select()
      .from(settings)
      .where(eq(settings.profileId, UNASSIGNED_PROFILE_ID))
      .all()

    tx.update(items)
      .set({ profileId: targetProfileId, updatedAt: now })
      .where(eq(items.profileId, UNASSIGNED_PROFILE_ID))
      .run()

    tx.update(tags)
      .set({ profileId: targetProfileId })
      .where(eq(tags.profileId, UNASSIGNED_PROFILE_ID))
      .run()

    tx.update(playlists)
      .set({ profileId: targetProfileId, updatedAt: now })
      .where(eq(playlists.profileId, UNASSIGNED_PROFILE_ID))
      .run()

    for (const setting of unassignedSettings) {
      const profileId = SYSTEM_SETTING_KEYS.has(setting.key) ? SYSTEM_PROFILE_ID : targetProfileId
      tx.insert(settings)
        .values({ profileId, key: setting.key, value: setting.value })
        .onConflictDoNothing()
        .run()
    }

    tx.delete(settings)
      .where(eq(settings.profileId, UNASSIGNED_PROFILE_ID))
      .run()
  })
}

function getProfileTagNames(tx: Tx, itemId: number) {
  return tx.select({ name: tags.name })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(eq(itemTags.itemId, itemId))
    .all()
    .map((row) => row.name)
}

function getOrCreateTag(tx: Tx, profileId: number, name: string) {
  const existing = tx.select()
    .from(tags)
    .where(and(eq(tags.profileId, profileId), eq(tags.name, name)))
    .get()

  if (existing) return existing

  return tx.insert(tags)
    .values({ profileId, name })
    .returning()
    .get()
}

function findDuplicateItem(tx: Tx, item: typeof items.$inferSelect, profileId: number) {
  return tx.select()
    .from(items)
    .where(and(
      eq(items.profileId, profileId),
      eq(items.filePath, item.filePath),
      eq(items.fileName, item.fileName),
      eq(items.fileExtension, item.fileExtension),
    ))
    .get()
}

function deleteItemRelations(tx: Tx, itemIds: number[]) {
  if (itemIds.length === 0) return

  tx.delete(reviews).where(inArray(reviews.itemId, itemIds)).run()
  tx.delete(itemTags).where(inArray(itemTags.itemId, itemIds)).run()
  tx.delete(playlistItems).where(inArray(playlistItems.itemId, itemIds)).run()
}

function deleteProfilePlaylists(tx: Tx, profileId: number) {
  const playlistIds = tx.select({ id: playlists.id })
    .from(playlists)
    .where(eq(playlists.profileId, profileId))
    .all()
    .map((playlist) => playlist.id)

  if (playlistIds.length > 0) {
    tx.delete(playlistItems).where(inArray(playlistItems.playlistId, playlistIds)).run()
  }

  tx.delete(playlists).where(eq(playlists.profileId, profileId)).run()
}

function moveItemWithTags(tx: Tx, item: typeof items.$inferSelect, targetProfileId: number, now: number) {
  const tagNames = Array.from(new Set(getProfileTagNames(tx, item.id)))

  tx.delete(itemTags).where(eq(itemTags.itemId, item.id)).run()
  tx.update(items)
    .set({ profileId: targetProfileId, updatedAt: now })
    .where(eq(items.id, item.id))
    .run()

  for (const tagName of tagNames) {
    const tag = getOrCreateTag(tx, targetProfileId, tagName)
    tx.insert(itemTags)
      .values({ itemId: item.id, tagId: tag.id })
      .onConflictDoNothing()
      .run()
  }
}

function cleanupUnusedTagsForProfile(tx: Tx, profileId: number) {
  tx.delete(tags)
    .where(sql`${tags.profileId} = ${profileId} AND NOT EXISTS (
      SELECT 1 FROM ${itemTags}
      WHERE ${itemTags.tagId} = ${tags.id}
    )`)
    .run()
}

function deleteUserProfile(db: DB, profileId: number, options: {
  mode: 'transfer' | 'delete'
  targetProfileId?: number
  duplicateStrategy?: 'target' | 'source'
}) {
  const profile = getProfileById(db, profileId)
  if (!profile || profile.id <= GUEST_PROFILE_ID) {
    return { ok: false as const, reason: 'missing-profile', status: getProfileStatus(db) }
  }

  const itemCount = getItemCountByProfileId(db, profileId)
  const transferMode = itemCount > 0 && options.mode === 'transfer'
  const targetProfile = transferMode && options.targetProfileId
    ? getProfileById(db, options.targetProfileId)
    : null

  if (itemCount > 0 && options.mode !== 'transfer' && options.mode !== 'delete') {
    return { ok: false as const, reason: 'missing-delete-mode', status: getProfileStatus(db) }
  }

  if (transferMode && (!targetProfile || targetProfile.id <= UNASSIGNED_PROFILE_ID || targetProfile.id === profileId)) {
    return { ok: false as const, reason: 'missing-target-profile', status: getProfileStatus(db) }
  }

  const duplicateStrategy = options.duplicateStrategy || 'target'
  if (transferMode && duplicateStrategy !== 'target' && duplicateStrategy !== 'source') {
    return { ok: false as const, reason: 'invalid-duplicate-strategy', status: getProfileStatus(db) }
  }

  const result = {
    transferred: 0,
    deleted: 0,
    overwritten: 0,
    keptDuplicates: 0,
  }
  const now = Date.now()

  db.transaction((tx) => {
    const sourceItems = tx.select()
      .from(items)
      .where(eq(items.profileId, profileId))
      .all() as Array<typeof items.$inferSelect>

    deleteProfilePlaylists(tx, profileId)

    if (transferMode && targetProfile) {
      for (const item of sourceItems) {
        const duplicate = findDuplicateItem(tx, item, targetProfile.id)

        if (duplicate && duplicateStrategy === 'target') {
          deleteItemRelations(tx, [item.id])
          tx.delete(items).where(eq(items.id, item.id)).run()
          result.deleted += 1
          result.keptDuplicates += 1
          continue
        }

        if (duplicate && duplicateStrategy === 'source') {
          const duplicatePlaylistItems = tx.select()
            .from(playlistItems)
            .where(eq(playlistItems.itemId, duplicate.id))
            .all() as Array<typeof playlistItems.$inferSelect>

          deleteItemRelations(tx, [duplicate.id])
          tx.delete(items).where(eq(items.id, duplicate.id)).run()
          moveItemWithTags(tx, item, targetProfile.id, now)

          for (const playlistItem of duplicatePlaylistItems) {
            tx.insert(playlistItems)
              .values({
                playlistId: playlistItem.playlistId,
                itemId: item.id,
                position: playlistItem.position,
                createdAt: playlistItem.createdAt,
              })
              .onConflictDoNothing()
              .run()
          }

          result.transferred += 1
          result.overwritten += 1
          continue
        }

        moveItemWithTags(tx, item, targetProfile.id, now)
        result.transferred += 1
      }

      cleanupUnusedTagsForProfile(tx, targetProfile.id)
    } else {
      const itemIds = sourceItems.map((item) => item.id)
      deleteItemRelations(tx, itemIds)
      tx.delete(items).where(eq(items.profileId, profileId)).run()
      result.deleted += itemIds.length
    }

    tx.delete(tags).where(eq(tags.profileId, profileId)).run()
    tx.delete(settings).where(eq(settings.profileId, profileId)).run()
    tx.delete(profiles).where(eq(profiles.id, profileId)).run()
  })

  forgetActiveProfileId(db, profileId)
  if (hasActiveProfile() && getActiveProfileId() === profileId) {
    clearActiveProfileId()
  }

  return { ok: true as const, profile, ...result, status: getProfileStatus(db) }
}

export function registerProfilesIPC(db: DB) {
  ensureProfileRows(db)

  ipcMain.handle('profiles:getStatus', async () => getProfileStatus(db))

  ipcMain.handle('profiles:clearSelection', async () => {
    if (hasActiveProfile()) {
      rememberActiveProfileId(db, getActiveProfileId())
    }
    autoSelectSuppressed = true
    clearActiveProfileId()
    return getProfileStatus(db)
  })

  ipcMain.handle('profiles:select', async (_event, { profileId, useOnNextStartup }: { profileId: number; useOnNextStartup?: boolean }) => {
    const profile = getProfileById(db, profileId)
    if (!profile || profile.id <= UNASSIGNED_PROFILE_ID) {
      return { ok: false, reason: 'missing-profile', status: getProfileStatus(db) }
    }

    try {
      transferUnassignedData(db, profile.id)
    } catch (error: any) {
      return { ok: false, reason: 'transfer-failed', message: String(error?.message || error), status: getProfileStatus(db) }
    }

    autoSelectSuppressed = false
    rememberActiveProfileId(db, profile.id)
    setSystemSetting(db, USE_LAST_PROFILE_ON_STARTUP_KEY, useOnNextStartup ? 'true' : 'false')
    setActiveProfileId(profile.id)
    return { ok: true, profile, status: getProfileStatus(db) }
  })

  ipcMain.handle('profiles:createAndSelect', async (_event, { name, useOnNextStartup }: { name: string; useOnNextStartup?: boolean }) => {
    const result = createProfile(db, name)
    if (!result.ok) return { ...result, status: getProfileStatus(db) }

    try {
      transferUnassignedData(db, result.profile.id)
    } catch (error: any) {
      return { ok: false, reason: 'transfer-failed', message: String(error?.message || error), status: getProfileStatus(db) }
    }

    autoSelectSuppressed = false
    rememberActiveProfileId(db, result.profile.id)
    setSystemSetting(db, USE_LAST_PROFILE_ON_STARTUP_KEY, useOnNextStartup ? 'true' : 'false')
    setActiveProfileId(result.profile.id)
    return { ok: true, profile: result.profile, status: getProfileStatus(db) }
  })

  ipcMain.handle('profiles:rename', async (_event, { profileId, name }: { profileId: number; name: string }) => {
    const result = renameProfile(db, profileId, name)
    return { ...result, status: getProfileStatus(db) }
  })

  ipcMain.handle('profiles:getDeleteSummary', async (_event, { profileId }: { profileId: number }) => {
    const profile = getProfileById(db, profileId)
    if (!profile || profile.id <= GUEST_PROFILE_ID) {
      return { ok: false, reason: 'missing-profile', status: getProfileStatus(db) }
    }

    return {
      ok: true,
      profile,
      itemCount: getItemCountByProfileId(db, profile.id),
      targets: getVisibleProfiles(db)
        .filter((target) => target.id !== profile.id)
        .map((target) => ({ id: target.id, name: target.name })),
      status: getProfileStatus(db),
    }
  })

  ipcMain.handle('profiles:delete', async (_event, {
    profileId,
    mode,
    targetProfileId,
    duplicateStrategy,
  }: {
    profileId: number
    mode: 'transfer' | 'delete'
    targetProfileId?: number
    duplicateStrategy?: 'target' | 'source'
  }) => deleteUserProfile(db, profileId, { mode, targetProfileId, duplicateStrategy }))
}

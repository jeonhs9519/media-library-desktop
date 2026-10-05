import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { SYSTEM_PROFILE_ID, UNASSIGNED_PROFILE_ID, GUEST_PROFILE_ID, profiles, itemTags, items, playlistItems, playlists, reviews, settings, tags } from '../db/schema'
import { getActiveProfileId } from '../services/profileState'
import { PLAYLIST_SELECTION_KEY, setSelectedPlaylist } from '../services/playlistSelection'
import { detectContainerType, getDefaultContentType } from '../utils/titleNormalizer'
import type { DB } from './items/utils'

type LegacyRow = Record<string, unknown>

type LegacyPreviewItem = {
  profileName: string
  previewId: string
  legacyId: number
  title: string
  filePath: string
  fileName: string
  fileExtension: string
  contentType: string
  watched: number
  progress: number
  hasThumbnail: boolean
  tagNames: string[]
  reviewRating?: number
  hasReview: boolean
  duplicate: boolean
  disabledReason?: 'duplicate' | 'invalid_entry'
}

type LegacyPreviewSetting = {
  profileName: string
  key: string
  value: string
  exists: boolean
}

type LegacyPreviewTag = {
  profileName: string
  id: number
  name: string
  exists: boolean
}

type LegacyPreviewResult = {
  profiles: Array<{ id: number; name: string; exists: boolean }>
  ok: boolean
  filePath?: string
  message?: string
  settings: LegacyPreviewSetting[]
  tags: LegacyPreviewTag[]
  items: LegacyPreviewItem[]
  stats: {
    sourceItemCount: number
    importableItemCount: number
    duplicateItemCount: number
    invalidItemCount: number
    tagCount: number
    reviewCount: number
    playlistCount: number
    playlistItemCount: number
  }
}

const REQUIRED_ITEM_COLUMNS = ['id', 'filePath', 'fileName', 'fileExtension', 'title']
const SYSTEM_SETTING_KEYS = new Set([
  'ui.language',
  'video.volume',
  'fileModifiedAt.updatePolicy',
  'profile.lastActiveId',
  'profile.lastActiveIds',
  'profile.useLastOnStartup',
])

function openLegacyDatabase(filePath: string) {
  return new Database(filePath, { readonly: true, fileMustExist: true })
}

function getTables(sqlite: Database.Database) {
  const rows = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
  return new Set(rows.map(row => row.name))
}

function getColumns(sqlite: Database.Database, tableName: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  return new Set(rows.map(row => row.name))
}

function tableCount(sqlite: Database.Database, tableName: string, tables: Set<string>) {
  if (!tables.has(tableName)) return 0
  return Number((sqlite.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count?: number })?.count ?? 0)
}

function readTable(sqlite: Database.Database, tableName: string, tables: Set<string>) {
  if (!tables.has(tableName)) return [] as LegacyRow[]
  return sqlite.prepare(`SELECT * FROM ${tableName}`).all() as LegacyRow[]
}

function stringValue(row: LegacyRow, key: string, fallback = '') {
  const value = row[key]
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return fallback
  return String(value)
}

function numberValue(row: LegacyRow, key: string, fallback = 0) {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function optionalNumberValue(row: LegacyRow, key: string) {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function optionalStringValue(row: LegacyRow, key: string) {
  const value = row[key]
  if (typeof value === 'string') return value.trim() ? value : ''
  return undefined
}

function optionalBufferValue(row: LegacyRow, key: string) {
  const value = row[key]
  return Buffer.isBuffer(value) ? value : undefined
}

function buildProfileMapping(db: DB | Parameters<Parameters<DB['transaction']>[0]>[0], rows: LegacyRow[], create = false) {
  const mapping = new Map<number, number>([
    [SYSTEM_PROFILE_ID, SYSTEM_PROFILE_ID],
    [UNASSIGNED_PROFILE_ID, getActiveProfileId()],
    [GUEST_PROFILE_ID, GUEST_PROFILE_ID],
  ])
  const preview: LegacyPreviewResult['profiles'] = []
  for (const row of rows) {
    const id = numberValue(row, 'id')
    const name = stringValue(row, 'name').trim()
    if (!Number.isInteger(id) || id <= 0 || !name) throw new Error('유효하지 않은 원본 프로필입니다.')
    if (id <= GUEST_PROFILE_ID) continue
    if (['SYSTEM', 'UNASSIGNED', 'GUEST'].includes(name) || name.length > 16) throw new Error(`유효하지 않은 프로필 이름: ${name}`)
    const existing = db.select().from(profiles).where(eq(profiles.name, name)).get()
    const now = Date.now()
    const targetId = existing?.id ?? (create
      ? db.insert(profiles).values({ name, createdAt: numberValue(row, 'createdAt', now), updatedAt: numberValue(row, 'updatedAt', now) }).returning().get().id
      : -id)
    mapping.set(id, targetId)
    preview.push({ id, name, exists: Boolean(existing) })
  }
  const resolve = (row: LegacyRow, key?: string) => {
    if (key && SYSTEM_SETTING_KEYS.has(key)) return SYSTEM_PROFILE_ID
    if (row.profileId == null) return getActiveProfileId()
    const id = mapping.get(numberValue(row, 'profileId'))
    if (id == null) throw new Error(`원본 프로필을 찾을 수 없습니다: ${row.profileId}`)
    return id
  }
  const name = (row: LegacyRow, key?: string) => {
    const id = resolve(row, key)
    return id < 0 ? preview.find(profile => profile.id === -id)!.name
      : db.select().from(profiles).where(eq(profiles.id, id)).get()?.name ?? ''
  }
  return { mapping, resolve, name, preview }
}

type ProfileMapping = ReturnType<typeof buildProfileMapping>

function validateLegacyDatabase(sqlite: Database.Database) {
  const tables = getTables(sqlite)
  if (!tables.has('items')) {
    return { ok: false, tables, message: 'items table not found' }
  }

  const itemColumns = getColumns(sqlite, 'items')
  const missingColumns = REQUIRED_ITEM_COLUMNS.filter(column => !itemColumns.has(column))
  if (missingColumns.length) {
    return { ok: false, tables, message: `items columns missing: ${missingColumns.join(', ')}` }
  }

  return { ok: true, tables, message: undefined }
}

function makePreviewItem(
  db: DB,
  row: LegacyRow,
  tagNamesByItemId: Map<number, string[]>,
  reviewByItemId: Map<number, LegacyRow>,
  profileMapping: ProfileMapping,
): LegacyPreviewItem {
  const legacyId = numberValue(row, 'id')
  const filePath = stringValue(row, 'filePath')
  const fileName = stringValue(row, 'fileName')
  const fileExtension = stringValue(row, 'fileExtension')
  const title = stringValue(row, 'title').trim()
  const contentType = stringValue(row, 'contentType').trim() || getDefaultContentType(detectContainerType(fileExtension))
  const review = reviewByItemId.get(legacyId)

  const invalid = !legacyId || !filePath || !fileName || !title
  const activeProfileId = profileMapping.resolve(row)
  const duplicate = invalid
    ? false
    : Boolean(db.select({ id: items.id }).from(items)
      .where(and(
        eq(items.profileId, activeProfileId),
        eq(items.filePath, filePath),
        eq(items.fileName, fileName),
        eq(items.fileExtension, fileExtension),
      ))
      .get())

  return {
    profileName: profileMapping.name(row),
    previewId: String(legacyId),
    legacyId,
    title,
    filePath,
    fileName,
    fileExtension,
    contentType,
    watched: numberValue(row, 'watched'),
    progress: numberValue(row, 'progress'),
    hasThumbnail: Boolean(optionalBufferValue(row, 'thumbnail')),
    tagNames: tagNamesByItemId.get(legacyId) ?? [],
    reviewRating: review ? numberValue(review, 'rating') : undefined,
    hasReview: Boolean(review),
    duplicate,
    disabledReason: invalid ? 'invalid_entry' : duplicate ? 'duplicate' : undefined,
  }
}

function buildPreviewTags(db: DB, rows: LegacyRow[], profileMapping: ProfileMapping): LegacyPreviewTag[] {
  return rows.map((row) => {
    const activeProfileId = profileMapping.resolve(row)
    const id = numberValue(row, 'id')
    const name = stringValue(row, 'name').trim()
    return {
      profileName: profileMapping.name(row),
      id,
      name,
      exists: name
        ? Boolean(db.select({ id: tags.id }).from(tags).where(and(eq(tags.profileId, activeProfileId), eq(tags.name, name))).get())
        : false,
    }
  }).filter(tag => tag.id && tag.name)
}

function buildPreviewSettings(db: DB, rows: LegacyRow[], profileMapping: ProfileMapping): LegacyPreviewSetting[] {
  return rows.map((row) => {
    const key = stringValue(row, 'key').trim()
    const profileId = profileMapping.resolve(row, key)
    return {
      profileName: profileMapping.name(row, key),
      key,
      value: stringValue(row, 'value'),
      exists: key
        ? Boolean(db.select({ key: settings.key }).from(settings).where(and(eq(settings.profileId, profileId), eq(settings.key, key))).get())
        : false,
    }
  }).filter(setting => setting.key)
}

function buildTagNamesByItemId(tagRows: LegacyPreviewTag[], itemTagRows: LegacyRow[]) {
  const nameByTagId = new Map(tagRows.map(tag => [tag.id, tag.name]))
  const tagNamesByItemId = new Map<number, string[]>()

  for (const row of itemTagRows) {
    const itemId = numberValue(row, 'itemId')
    const tagName = nameByTagId.get(numberValue(row, 'tagId'))
    if (!itemId || !tagName) continue
    tagNamesByItemId.set(itemId, [...(tagNamesByItemId.get(itemId) ?? []), tagName])
  }

  return tagNamesByItemId
}

function buildReviewByItemId(reviewRows: LegacyRow[]) {
  const reviewByItemId = new Map<number, LegacyRow>()
  for (const row of reviewRows) {
    const itemId = numberValue(row, 'itemId')
    if (itemId) reviewByItemId.set(itemId, row)
  }
  return reviewByItemId
}

function buildPreview(db: DB, dbPath: string): LegacyPreviewResult {
  const sqlite = openLegacyDatabase(dbPath)
  try {
    const validation = validateLegacyDatabase(sqlite)
    if (!validation.ok) {
      return {
        profiles: [],
        ok: false,
        filePath: dbPath,
        message: validation.message,
        settings: [],
        tags: [],
        items: [],
        stats: {
          sourceItemCount: 0,
          importableItemCount: 0,
          duplicateItemCount: 0,
          invalidItemCount: 0,
          tagCount: 0,
          reviewCount: 0,
          playlistCount: 0,
          playlistItemCount: 0,
        },
      }
    }

    const profileMapping = buildProfileMapping(db, readTable(sqlite, 'profiles', validation.tables))
    const itemRows = readTable(sqlite, 'items', validation.tables)
    const tagRows = buildPreviewTags(db, readTable(sqlite, 'tags', validation.tables), profileMapping)
    const settingRows = buildPreviewSettings(db, readTable(sqlite, 'settings', validation.tables), profileMapping)
    const tagNamesByItemId = buildTagNamesByItemId(tagRows, readTable(sqlite, 'itemTags', validation.tables))
    const reviewByItemId = buildReviewByItemId(readTable(sqlite, 'reviews', validation.tables))
    const previewItems = itemRows.map(row => makePreviewItem(db, row, tagNamesByItemId, reviewByItemId, profileMapping))
    const duplicateItemCount = previewItems.filter(item => item.disabledReason === 'duplicate').length
    const invalidItemCount = previewItems.filter(item => item.disabledReason === 'invalid_entry').length

    return {
      profiles: profileMapping.preview,
      ok: true,
      filePath: dbPath,
      settings: settingRows,
      tags: tagRows,
      items: previewItems,
      stats: {
        sourceItemCount: previewItems.length,
        importableItemCount: previewItems.filter(item => !item.disabledReason).length,
        duplicateItemCount,
        invalidItemCount,
        tagCount: tableCount(sqlite, 'tags', validation.tables),
        reviewCount: tableCount(sqlite, 'reviews', validation.tables),
        playlistCount: tableCount(sqlite, 'playlists', validation.tables),
        playlistItemCount: tableCount(sqlite, 'playlistItems', validation.tables),
      },
    }
  } finally {
    sqlite.close()
  }
}

function importLegacyDatabase(db: DB, dbPath: string) {
  const preview = buildPreview(db, dbPath)
  if (!preview.ok) {
    return { ok: false, message: preview.message, imported: 0, skipped: 0 }
  }

  const importableLegacyIds = new Set(preview.items.filter(item => !item.disabledReason).map(item => item.legacyId))
  const legacyToCurrentItemId = new Map<number, number>()
  const legacyToCurrentTagId = new Map<number, number>()
  let imported = 0
  let skipped = preview.stats.duplicateItemCount + preview.stats.invalidItemCount
  let importedTags = 0
  let importedReviews = 0
  let importedPlaylistItems = 0
  let importedSettings = 0
  let importedProfiles = 0

  const sqlite = openLegacyDatabase(dbPath)
  try {
    const validation = validateLegacyDatabase(sqlite)
    if (!validation.ok) {
      return { ok: false, message: validation.message, imported: 0, skipped }
    }

    db.transaction((tx) => {
      const profileMapping = buildProfileMapping(tx, readTable(sqlite, 'profiles', validation.tables), true)
      importedProfiles = profileMapping.preview.filter(profile => !profile.exists).length
      for (const row of readTable(sqlite, 'items', validation.tables)) {
        const legacyId = numberValue(row, 'id')
        if (!importableLegacyIds.has(legacyId)) continue

        const now = Date.now()
        const fileExtension = stringValue(row, 'fileExtension')
        const contentType = stringValue(row, 'contentType').trim() || getDefaultContentType(detectContainerType(fileExtension))
        const inserted = tx.insert(items).values({
          profileId: profileMapping.resolve(row),
          filePath: stringValue(row, 'filePath'),
          fileName: stringValue(row, 'fileName'),
          fileExtension,
          title: stringValue(row, 'title').trim(),
          sourceUrl: optionalStringValue(row, 'sourceUrl'),
          author: optionalStringValue(row, 'author'),
          memo: optionalStringValue(row, 'memo'),
          contentType,
          containerType: detectContainerType(fileExtension),
          language: stringValue(row, 'language').trim() || 'unspecified',
          watched: numberValue(row, 'watched'),
          progress: numberValue(row, 'progress'),
          lastPageIndex: optionalNumberValue(row, 'lastPageIndex'),
          bookScrollZoom: optionalNumberValue(row, 'bookScrollZoom') != null && numberValue(row, 'bookScrollZoom') >= 0.5 && numberValue(row, 'bookScrollZoom') <= 3 ? numberValue(row, 'bookScrollZoom') : null,
          bookScrollOffset: optionalNumberValue(row, 'bookScrollOffset') != null && numberValue(row, 'bookScrollOffset') >= 0 && numberValue(row, 'bookScrollOffset') <= 1 ? numberValue(row, 'bookScrollOffset') : null,
          bookViewMode: ['single', 'scroll', 'double-ltr', 'double-rtl'].includes(stringValue(row, 'bookViewMode')) ? stringValue(row, 'bookViewMode') : null,
          lastPositionSeconds: optionalNumberValue(row, 'lastPositionSeconds'),
          totalContent: optionalNumberValue(row, 'totalContent'),
          thumbnail: optionalBufferValue(row, 'thumbnail'),
          createdAt: numberValue(row, 'createdAt', now),
          updatedAt: numberValue(row, 'updatedAt', now),
          fileModifiedAt: optionalNumberValue(row, 'fileModifiedAt'),
        }).returning().get()
        legacyToCurrentItemId.set(legacyId, inserted.id)
        imported++
      }

      for (const row of readTable(sqlite, 'tags', validation.tables)) {
        const activeProfileId = profileMapping.resolve(row)
        const legacyTagId = numberValue(row, 'id')
        const name = stringValue(row, 'name').trim()
        if (!legacyTagId || !name) continue

        const existing = tx.select({ id: tags.id }).from(tags).where(and(eq(tags.profileId, activeProfileId), eq(tags.name, name))).get()
        const currentTag = existing ?? tx.insert(tags).values({ profileId: activeProfileId, name }).returning({ id: tags.id }).get()
        if (!existing) importedTags++
        legacyToCurrentTagId.set(legacyTagId, currentTag.id)
      }

      for (const row of readTable(sqlite, 'itemTags', validation.tables)) {
        const currentItemId = legacyToCurrentItemId.get(numberValue(row, 'itemId'))
        const currentTagId = legacyToCurrentTagId.get(numberValue(row, 'tagId'))
        if (!currentItemId || !currentTagId) continue
        const item = tx.select().from(items).where(eq(items.id, currentItemId)).get()!
        const tag = tx.select().from(tags).where(eq(tags.id, currentTagId)).get()!
        if (item.profileId !== tag.profileId) continue
        tx.insert(itemTags).values({ itemId: currentItemId, tagId: currentTagId }).onConflictDoNothing().run()
      }

      for (const row of readTable(sqlite, 'reviews', validation.tables)) {
        const currentItemId = legacyToCurrentItemId.get(numberValue(row, 'itemId'))
        if (!currentItemId) continue
        const now = Date.now()
        tx.insert(reviews).values({
          itemId: currentItemId,
          rating: numberValue(row, 'rating'),
          comment: optionalStringValue(row, 'comment'),
          createdAt: numberValue(row, 'createdAt', now),
          updatedAt: numberValue(row, 'updatedAt', now),
        }).onConflictDoNothing().run()
        importedReviews++
      }

      for (const row of readTable(sqlite, 'settings', validation.tables)) {
        const key = stringValue(row, 'key').trim()
        let value = stringValue(row, 'value')
        if (!key || key === PLAYLIST_SELECTION_KEY) continue
        const profileId = profileMapping.resolve(row, key)
        if (key === 'profile.lastActiveId') {
          const mappedId = profileMapping.mapping.get(Number(value))
          value = String(mappedId && mappedId > UNASSIGNED_PROFILE_ID ? mappedId : GUEST_PROFILE_ID)
        }
        if (key === 'profile.lastActiveIds') {
          let ids: unknown
          try { ids = JSON.parse(value) } catch { ids = value.split(',') }
          const mappedIds = Array.isArray(ids) ? ids.map(id => profileMapping.mapping.get(Number(id)))
            .filter((id): id is number => id != null && id > UNASSIGNED_PROFILE_ID) : []
          value = JSON.stringify([...new Set(mappedIds)].slice(0, 2))
        }
        const existing = tx.select({ key: settings.key }).from(settings).where(and(eq(settings.profileId, profileId), eq(settings.key, key))).get()
        if (existing) continue
        tx.insert(settings).values({ profileId, key, value }).run()
        importedSettings++
      }

      const legacyToCurrentPlaylistId = new Map<number, number>()
      for (const row of readTable(sqlite, 'playlists', validation.tables)) {
        const activeProfileId = profileMapping.resolve(row)
        const legacyPlaylistId = numberValue(row, 'id')
        const name = stringValue(row, 'name').trim()
        if (!legacyPlaylistId || !name) continue
        const now = Date.now()
        const existing = tx.select({ id: playlists.id }).from(playlists).where(and(eq(playlists.profileId, activeProfileId), eq(playlists.name, name))).get()
        const currentPlaylist = existing ?? tx.insert(playlists).values({
          profileId: activeProfileId,
          name,
          createdAt: numberValue(row, 'createdAt', now),
          updatedAt: numberValue(row, 'updatedAt', now),
        }).returning({ id: playlists.id }).get()
        legacyToCurrentPlaylistId.set(legacyPlaylistId, currentPlaylist.id)
      }

      for (const row of readTable(sqlite, 'settings', validation.tables)) {
        if (stringValue(row, 'key') !== PLAYLIST_SELECTION_KEY) continue
        const profileId = profileMapping.resolve(row)
        const existingSelection = tx.select().from(settings)
          .where(and(eq(settings.profileId, profileId), eq(settings.key, PLAYLIST_SELECTION_KEY))).get()
        const selectedId = legacyToCurrentPlaylistId.get(numberValue(row, 'value'))
        const selected = selectedId ? tx.select().from(playlists).where(eq(playlists.id, selectedId)).get() : undefined
        if (!existingSelection && selected?.profileId === profileId) {
          setSelectedPlaylist(tx, profileId, selected.id)
          importedSettings++
        }
      }

      for (const row of readTable(sqlite, 'playlistItems', validation.tables)) {
        const currentPlaylistId = legacyToCurrentPlaylistId.get(numberValue(row, 'playlistId'))
        const currentItemId = legacyToCurrentItemId.get(numberValue(row, 'itemId'))
        if (!currentPlaylistId || !currentItemId) continue
        const playlist = tx.select().from(playlists).where(eq(playlists.id, currentPlaylistId)).get()!
        const item = tx.select().from(items).where(eq(items.id, currentItemId)).get()!
        if (playlist.profileId !== item.profileId) continue
        tx.insert(playlistItems).values({
          playlistId: currentPlaylistId,
          itemId: currentItemId,
          position: numberValue(row, 'position'),
          createdAt: numberValue(row, 'createdAt', Date.now()),
        }).onConflictDoNothing().run()
        importedPlaylistItems++
      }
      const tagIds = [...legacyToCurrentTagId.values()]
      if (tagIds.length) tx.delete(tags).where(and(inArray(tags.id, tagIds), sql`NOT EXISTS (
        SELECT 1 FROM ${itemTags} WHERE ${itemTags.tagId} = ${tags.id}
      )`)).run()
    })

    return {
      ok: true,
      imported,
      skipped,
      importedTags,
      importedReviews,
      importedPlaylistItems,
      importedSettings,
      importedProfiles,
    }
  } finally {
    sqlite.close()
  }
}

export function registerLegacyDatabaseIPC(db: DB) {
  ipcMain.handle('legacyDatabase:preview', async (_event, { filePath }: { filePath: string }) => {
    if (!filePath || path.extname(filePath).toLowerCase() !== '.db') {
      return buildEmptyPreview(filePath, 'media-library.db 파일을 선택해주세요.')
    }

    if (!fs.existsSync(filePath)) {
      return buildEmptyPreview(filePath, '선택한 파일을 찾을 수 없습니다.')
    }

    try {
      return buildPreview(db, filePath)
    } catch (error) {
      return buildEmptyPreview(filePath, String((error as Error)?.message || error))
    }
  })

  ipcMain.handle('legacyDatabase:import', async (_event, { filePath }: { filePath: string }) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { ok: false, message: '선택한 파일을 찾을 수 없습니다.', imported: 0, skipped: 0 }
    }

    try {
      return importLegacyDatabase(db, filePath)
    } catch (error) {
      return { ok: false, message: String((error as Error)?.message || error), imported: 0, skipped: 0 }
    }
  })
}

function buildEmptyPreview(filePath: string | undefined, message: string): LegacyPreviewResult {
  return {
    profiles: [],
    ok: false,
    filePath,
    message,
    settings: [],
    tags: [],
    items: [],
    stats: {
      sourceItemCount: 0,
      importableItemCount: 0,
      duplicateItemCount: 0,
      invalidItemCount: 0,
      tagCount: 0,
      reviewCount: 0,
      playlistCount: 0,
      playlistItemCount: 0,
    },
  }
}

import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { and, eq } from 'drizzle-orm'
import { itemTags, items, playlistItems, playlists, reviews, settings, tags } from '../db/schema'
import { cleanupUnusedTags } from '../services/tagMaintenance'
import type { DB } from './items/utils'

type LegacyRow = Record<string, unknown>

type LegacyPreviewItem = {
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
  key: string
  value: string
  exists: boolean
}

type LegacyPreviewTag = {
  id: number
  name: string
  exists: boolean
}

type LegacyPreviewResult = {
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
  if (typeof value === 'string' && value.trim()) return value
  return undefined
}

function optionalBufferValue(row: LegacyRow, key: string) {
  const value = row[key]
  return Buffer.isBuffer(value) ? value : undefined
}

function buildContainerType(contentType: string, fileExtension: string) {
  if (contentType === 'video') return 'video'
  if (fileExtension.toLowerCase() === 'pdf') return 'pdf'
  if (fileExtension.toLowerCase() === 'cbz') return 'zip'
  return 'zip'
}

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
): LegacyPreviewItem {
  const legacyId = numberValue(row, 'id')
  const filePath = stringValue(row, 'filePath').trim()
  const fileName = stringValue(row, 'fileName').trim()
  const fileExtension = stringValue(row, 'fileExtension').trim()
  const title = stringValue(row, 'title').trim()
  const contentType = stringValue(row, 'contentType', 'comic').trim() || 'comic'
  const review = reviewByItemId.get(legacyId)

  const invalid = !legacyId || !filePath || !fileName || !title
  const duplicate = invalid
    ? false
    : Boolean(db.select({ id: items.id }).from(items)
      .where(and(eq(items.filePath, filePath), eq(items.fileName, fileName), eq(items.fileExtension, fileExtension)))
      .get())

  return {
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

function buildPreviewTags(db: DB, rows: LegacyRow[]): LegacyPreviewTag[] {
  return rows.map((row) => {
    const id = numberValue(row, 'id')
    const name = stringValue(row, 'name').trim()
    return {
      id,
      name,
      exists: name ? Boolean(db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get()) : false,
    }
  }).filter(tag => tag.id && tag.name)
}

function buildPreviewSettings(db: DB, rows: LegacyRow[]): LegacyPreviewSetting[] {
  return rows.map((row) => {
    const key = stringValue(row, 'key').trim()
    return {
      key,
      value: stringValue(row, 'value'),
      exists: key ? Boolean(db.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).get()) : false,
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

    const itemRows = readTable(sqlite, 'items', validation.tables)
    const tagRows = buildPreviewTags(db, readTable(sqlite, 'tags', validation.tables))
    const settingRows = buildPreviewSettings(db, readTable(sqlite, 'settings', validation.tables))
    const tagNamesByItemId = buildTagNamesByItemId(tagRows, readTable(sqlite, 'itemTags', validation.tables))
    const reviewByItemId = buildReviewByItemId(readTable(sqlite, 'reviews', validation.tables))
    const previewItems = itemRows.map(row => makePreviewItem(db, row, tagNamesByItemId, reviewByItemId))
    const duplicateItemCount = previewItems.filter(item => item.disabledReason === 'duplicate').length
    const invalidItemCount = previewItems.filter(item => item.disabledReason === 'invalid_entry').length

    return {
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

  const sqlite = openLegacyDatabase(dbPath)
  try {
    const validation = validateLegacyDatabase(sqlite)
    if (!validation.ok) {
      return { ok: false, message: validation.message, imported: 0, skipped }
    }

    db.transaction((tx) => {
      for (const row of readTable(sqlite, 'items', validation.tables)) {
        const legacyId = numberValue(row, 'id')
        if (!importableLegacyIds.has(legacyId)) continue

        const now = Date.now()
        const fileExtension = stringValue(row, 'fileExtension').trim()
        const contentType = stringValue(row, 'contentType', 'comic').trim() || 'comic'
        const inserted = tx.insert(items).values({
          filePath: stringValue(row, 'filePath').trim(),
          fileName: stringValue(row, 'fileName').trim(),
          fileExtension,
          title: stringValue(row, 'title').trim(),
          sourceUrl: optionalStringValue(row, 'sourceUrl'),
          author: optionalStringValue(row, 'author'),
          memo: optionalStringValue(row, 'memo'),
          contentType,
          containerType: stringValue(row, 'containerType').trim() || buildContainerType(contentType, fileExtension),
          language: stringValue(row, 'language'),
          watched: numberValue(row, 'watched'),
          progress: numberValue(row, 'progress'),
          lastPageIndex: optionalNumberValue(row, 'lastPageIndex'),
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
        const legacyTagId = numberValue(row, 'id')
        const name = stringValue(row, 'name').trim()
        if (!legacyTagId || !name) continue

        const existing = tx.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).get()
        const currentTag = existing ?? tx.insert(tags).values({ name }).returning({ id: tags.id }).get()
        if (!existing) importedTags++
        legacyToCurrentTagId.set(legacyTagId, currentTag.id)
      }

      for (const row of readTable(sqlite, 'itemTags', validation.tables)) {
        const currentItemId = legacyToCurrentItemId.get(numberValue(row, 'itemId'))
        const currentTagId = legacyToCurrentTagId.get(numberValue(row, 'tagId'))
        if (!currentItemId || !currentTagId) continue
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
        const value = stringValue(row, 'value')
        if (!key) continue
        const existing = tx.select({ key: settings.key }).from(settings).where(eq(settings.key, key)).get()
        if (existing) continue
        tx.insert(settings).values({ key, value }).run()
        importedSettings++
      }

      const legacyToCurrentPlaylistId = new Map<number, number>()
      for (const row of readTable(sqlite, 'playlists', validation.tables)) {
        const legacyPlaylistId = numberValue(row, 'id')
        const name = stringValue(row, 'name').trim()
        if (!legacyPlaylistId || !name) continue
        const now = Date.now()
        const existing = tx.select({ id: playlists.id }).from(playlists).where(eq(playlists.name, name)).get()
        const currentPlaylist = existing ?? tx.insert(playlists).values({
          name,
          createdAt: numberValue(row, 'createdAt', now),
          updatedAt: numberValue(row, 'updatedAt', now),
        }).returning({ id: playlists.id }).get()
        legacyToCurrentPlaylistId.set(legacyPlaylistId, currentPlaylist.id)
      }

      for (const row of readTable(sqlite, 'playlistItems', validation.tables)) {
        const currentPlaylistId = legacyToCurrentPlaylistId.get(numberValue(row, 'playlistId'))
        const currentItemId = legacyToCurrentItemId.get(numberValue(row, 'itemId'))
        if (!currentPlaylistId || !currentItemId) continue
        tx.insert(playlistItems).values({
          playlistId: currentPlaylistId,
          itemId: currentItemId,
          position: numberValue(row, 'position'),
          createdAt: numberValue(row, 'createdAt', Date.now()),
        }).onConflictDoNothing().run()
        importedPlaylistItems++
      }
    })

    cleanupUnusedTags(db)
    return {
      ok: true,
      imported,
      skipped,
      importedTags,
      importedReviews,
      importedPlaylistItems,
      importedSettings,
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

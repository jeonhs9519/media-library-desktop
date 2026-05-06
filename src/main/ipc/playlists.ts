import { ipcMain } from 'electron'
import { asc, eq, sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { items, playlistItems, playlists } from '../db/schema'
import { getActiveProfileId } from '../services/profileState'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

type DB = BetterSQLite3Database<typeof schema>

const DEFAULT_PLAYLIST_NAME = 'Default'
const allowedContentTypes = new Set(['book', 'comic', 'video'])

function getDefaultPlaylist(db: DB) {
  const activeProfileId = getActiveProfileId()
  const existing = db.select().from(playlists)
    .where(sql`${playlists.profileId} = ${activeProfileId} AND ${playlists.name} = ${DEFAULT_PLAYLIST_NAME}`)
    .get()
  if (existing) return existing

  const now = Date.now()
  return db.insert(playlists).values({
    profileId: activeProfileId,
    name: DEFAULT_PLAYLIST_NAME,
    createdAt: now,
    updatedAt: now,
  }).returning().get()
}

function withFileExists<T extends {
  filePath: string
  fileName: string
  fileExtension: string
}>(item: T) {
  return {
    ...item,
    fileExists: fs.existsSync(path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : ''))),
  }
}

function reorderPlaylistItems(db: DB, playlistId: number, orderedItemIds: number[]) {
  db.transaction((tx) => {
    orderedItemIds.forEach((itemId, position) => {
      tx.update(playlistItems)
        .set({ position })
        .where(sql`${playlistItems.playlistId} = ${playlistId} AND ${playlistItems.itemId} = ${itemId}`)
        .run()
    })
  })
}

export function registerPlaylistsIPC(db: DB) {
  ipcMain.handle('playlists:getDefault', async () => getDefaultPlaylist(db))

  ipcMain.handle('playlists:getItems', async () => {
    const playlist = getDefaultPlaylist(db)
    const rows = db.select({
      playlistId: playlistItems.playlistId,
      itemId: playlistItems.itemId,
      position: playlistItems.position,
      createdAt: playlistItems.createdAt,
      item: {
        id: items.id,
        filePath: items.filePath,
        fileName: items.fileName,
        fileExtension: items.fileExtension,
        title: items.title,
        sourceUrl: items.sourceUrl,
        contentType: items.contentType,
        containerType: items.containerType,
        language: items.language,
        watched: items.watched,
        progress: items.progress,
        totalContent: items.totalContent,
        author: items.author,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
        fileModifiedAt: items.fileModifiedAt,
        thumbnail: items.thumbnail,
      },
    })
      .from(playlistItems)
      .innerJoin(items, eq(playlistItems.itemId, items.id))
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(asc(playlistItems.position), asc(playlistItems.createdAt))
      .all()

    return rows.map((row) => ({
      ...row,
      item: {
        ...withFileExists(row.item),
        thumbnailBase64: row.item.thumbnail
          ? Buffer.from(row.item.thumbnail as Buffer).toString('base64')
          : null,
        thumbnail: undefined,
      },
    }))
  })

  ipcMain.handle('playlists:addItem', async (_event, { itemId, position }: { itemId: number; position?: number }) => {
    const playlist = getDefaultPlaylist(db)
    const item = db.select().from(items)
      .where(sql`${items.id} = ${itemId} AND ${items.profileId} = ${getActiveProfileId()}`)
      .get()
    if (!item) return { ok: false, reason: 'missing-item' }
    if (!allowedContentTypes.has(item.contentType)) return { ok: false, reason: 'unsupported-type' }

    const now = Date.now()
    const currentRows = db.select({ itemId: playlistItems.itemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(asc(playlistItems.position), asc(playlistItems.createdAt))
      .all()
    const currentItemIds = currentRows.map((row) => row.itemId)
    const existing = currentItemIds.includes(itemId)
    const targetPosition = Number.isInteger(position)
      ? Math.min(Math.max(position ?? currentItemIds.length, 0), currentItemIds.length)
      : currentItemIds.length
    const orderedItemIds = currentItemIds.filter((currentItemId) => currentItemId !== itemId)
    orderedItemIds.splice(Math.min(targetPosition, orderedItemIds.length), 0, itemId)

    db.transaction((tx) => {
      if (!existing) {
        tx.insert(playlistItems).values({
          playlistId: playlist.id,
          itemId,
          position: orderedItemIds.length - 1,
          createdAt: now,
        }).run()
      }

      orderedItemIds.forEach((targetItemId, nextPosition) => {
        tx.update(playlistItems)
          .set({ position: nextPosition })
          .where(sql`${playlistItems.playlistId} = ${playlist.id} AND ${playlistItems.itemId} = ${targetItemId}`)
          .run()
      })
      tx.update(playlists).set({ updatedAt: now }).where(eq(playlists.id, playlist.id)).run()
    })
    return { ok: true }
  })

  ipcMain.handle('playlists:removeItem', async (_event, { itemId }: { itemId: number }) => {
    const playlist = getDefaultPlaylist(db)
    db.delete(playlistItems)
      .where(sql`${playlistItems.playlistId} = ${playlist.id} AND ${playlistItems.itemId} = ${itemId}`)
      .run()
    db.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlist.id)).run()
    return { ok: true }
  })

  ipcMain.handle('playlists:reorderItems', async (_event, { itemIds }: { itemIds: number[] }) => {
    const playlist = getDefaultPlaylist(db)
    const uniqueItemIds = Array.from(new Set(itemIds.filter((itemId) => Number.isInteger(itemId) && itemId > 0)))
    const currentRows = db.select({
      itemId: playlistItems.itemId,
    })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(asc(playlistItems.position), asc(playlistItems.createdAt))
      .all()
    const currentItemIds = currentRows.map((row) => row.itemId)
    const currentItemIdSet = new Set(currentItemIds)
    const orderedItemIds = [
      ...uniqueItemIds.filter((itemId) => currentItemIdSet.has(itemId)),
      ...currentItemIds.filter((itemId) => !uniqueItemIds.includes(itemId)),
    ]

    const now = Date.now()
    reorderPlaylistItems(db, playlist.id, orderedItemIds)
    db.update(playlists).set({ updatedAt: now }).where(eq(playlists.id, playlist.id)).run()

    return { ok: true }
  })

  ipcMain.handle('playlists:clear', async () => {
    const playlist = getDefaultPlaylist(db)
    db.delete(playlistItems).where(eq(playlistItems.playlistId, playlist.id)).run()
    db.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlist.id)).run()
    return { ok: true }
  })
}

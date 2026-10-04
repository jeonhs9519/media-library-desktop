import { ipcMain } from 'electron'
import { asc, eq, sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { items, playlistItems, playlists } from '../db/schema'
import { getActiveProfileId } from '../services/profileState'
import { findProfilePlaylist, getSelectedPlaylist, setSelectedPlaylist } from '../services/playlistSelection'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

type DB = BetterSQLite3Database<typeof schema>

const allowedFileTypes = new Set(['pdf', 'zip', 'video'])

function resolvePlaylist(db: DB, id?: number) {
  const profileId = getActiveProfileId()
  return id === undefined ? getSelectedPlaylist(db, profileId) : findProfilePlaylist(db, profileId, id)
}

function playlistName(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
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
  ipcMain.handle('playlists:getDefault', async () => getSelectedPlaylist(db, getActiveProfileId()))

  ipcMain.handle('playlists:getState', async () => {
    const profileId = getActiveProfileId()
    const selected = getSelectedPlaylist(db, profileId)
    const lists = db.select({ id: playlists.id, name: playlists.name,
      count: sql<number>`count(${playlistItems.itemId})`.mapWith(Number),
    }).from(playlists).leftJoin(playlistItems, eq(playlistItems.playlistId, playlists.id))
      .where(eq(playlists.profileId, profileId)).groupBy(playlists.id).orderBy(asc(playlists.id)).all()
    return { profileId, selectedId: selected.id, lists }
  })

  ipcMain.handle('playlists:getItemPlaylistIds', async (_event, { itemId }: { itemId: number }) => {
    if (!Number.isSafeInteger(itemId) || itemId <= 0) return []
    const profileId = getActiveProfileId()
    return db.select({ id: playlistItems.playlistId }).from(playlistItems)
      .innerJoin(playlists, eq(playlistItems.playlistId, playlists.id))
      .innerJoin(items, eq(playlistItems.itemId, items.id))
      .where(sql`${playlistItems.itemId} = ${itemId} AND ${playlists.profileId} = ${profileId} AND ${items.profileId} = ${profileId}`)
      .orderBy(asc(playlistItems.playlistId)).all().map(row => row.id)
  })

  ipcMain.handle('playlists:select', async (_event, { id, profileId }: { id: number; profileId: number }) => {
    if (profileId !== getActiveProfileId()) return { ok: false, reason: 'profile-changed' }
    if (!findProfilePlaylist(db, profileId, id)) return { ok: false, reason: 'not-found' }
    setSelectedPlaylist(db, profileId, id)
    return { ok: true }
  })

  for (const action of ['create', 'rename'] as const) {
    ipcMain.handle(`playlists:${action}`, async (_event, { id, name: rawName, profileId }: { id?: number; name: string; profileId: number }) => {
      if (profileId !== getActiveProfileId()) return { ok: false, reason: 'profile-changed' }
      const name = playlistName(rawName)
      if (!name || name.length > 100) return { ok: false, reason: 'invalid-name' }
      if (action === 'rename' && !findProfilePlaylist(db, profileId, id!)) return { ok: false, reason: 'not-found' }
      const existing = db.select().from(playlists)
        .where(sql`${playlists.profileId} = ${profileId} AND ${playlists.name} = ${name}`).get()
      if (existing && (action === 'create' || existing.id !== id)) return { ok: false, reason: 'duplicate-name' }
      const now = Date.now()
      const playlist = db.transaction((tx) => {
        if (action === 'rename') {
          return tx.update(playlists).set({ name, updatedAt: now }).where(eq(playlists.id, id!)).returning().get()
        }
        const created = tx.insert(playlists).values({ profileId, name, createdAt: now, updatedAt: now }).returning().get()
        setSelectedPlaylist(tx, profileId, created.id)
        return created
      })
      return { ok: true, id: playlist.id }
    })
  }

  ipcMain.handle('playlists:delete', async (_event, { id, profileId }: { id: number; profileId: number }) => {
    if (profileId !== getActiveProfileId()) return { ok: false, reason: 'profile-changed' }
    if (!findProfilePlaylist(db, profileId, id)) return { ok: false, reason: 'not-found' }
    const lists = db.select().from(playlists).where(eq(playlists.profileId, profileId)).orderBy(asc(playlists.id)).all()
    if (lists.length <= 1) return { ok: false, reason: 'last-playlist' }
    db.transaction((tx) => {
      const selected = getSelectedPlaylist(tx, profileId)
      tx.delete(playlistItems).where(eq(playlistItems.playlistId, id)).run()
      tx.delete(playlists).where(eq(playlists.id, id)).run()
      if (selected.id === id) setSelectedPlaylist(tx, profileId, lists.find(list => list.id !== id)!.id)
    })
    return { ok: true }
  })

  ipcMain.handle('playlists:getItems', async (_event, { playlistId }: { playlistId?: number } = {}) => {
    const playlist = resolvePlaylist(db, playlistId)
    if (!playlist) return []
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

  ipcMain.handle('playlists:addItem', async (_event, { itemId, position, playlistId }: { itemId: number; position?: number; playlistId?: number }) => {
    const playlist = resolvePlaylist(db, playlistId)
    if (!playlist) return { ok: false, reason: 'not-found' }
    const item = db.select().from(items)
      .where(sql`${items.id} = ${itemId} AND ${items.profileId} = ${getActiveProfileId()}`)
      .get()
    if (!item) return { ok: false, reason: 'missing-item' }
    if (!allowedFileTypes.has(item.containerType)) return { ok: false, reason: 'unsupported-type' }

    const now = Date.now()
    const currentRows = db.select({ itemId: playlistItems.itemId })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlist.id))
      .orderBy(asc(playlistItems.position), asc(playlistItems.createdAt))
      .all()
    const currentItemIds = currentRows.map((row) => row.itemId)
    const existing = currentItemIds.includes(itemId)
    if (existing && position === undefined) return { ok: true }
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

  ipcMain.handle('playlists:removeItem', async (_event, { itemId, playlistId }: { itemId: number; playlistId?: number }) => {
    const playlist = resolvePlaylist(db, playlistId)
    if (!playlist) return { ok: false, reason: 'not-found' }
    db.delete(playlistItems)
      .where(sql`${playlistItems.playlistId} = ${playlist.id} AND ${playlistItems.itemId} = ${itemId}`)
      .run()
    db.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlist.id)).run()
    return { ok: true }
  })

  ipcMain.handle('playlists:reorderItems', async (_event, { itemIds, playlistId }: { itemIds: number[]; playlistId?: number }) => {
    const playlist = resolvePlaylist(db, playlistId)
    if (!playlist) return { ok: false, reason: 'not-found' }
    if (!Array.isArray(itemIds) || itemIds.some(id => !Number.isSafeInteger(id))) return { ok: false, reason: 'invalid-items' }
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

  ipcMain.handle('playlists:clear', async (_event, { playlistId }: { playlistId?: number } = {}) => {
    const playlist = resolvePlaylist(db, playlistId)
    if (!playlist) return { ok: false, reason: 'not-found' }
    db.delete(playlistItems).where(eq(playlistItems.playlistId, playlist.id)).run()
    db.update(playlists).set({ updatedAt: Date.now() }).where(eq(playlists.id, playlist.id)).run()
    return { ok: true }
  })
}

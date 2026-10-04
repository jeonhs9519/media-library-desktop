import { asc, eq, sql } from 'drizzle-orm'
import { playlists, settings } from '../db/schema'
import type { DB } from '../ipc/items/utils'

export const PLAYLIST_SELECTION_KEY = 'playlist.activeId'

export function setSelectedPlaylist(db: DB, profileId: number, id: number) {
  db.insert(settings).values({ profileId, key: PLAYLIST_SELECTION_KEY, value: String(id) })
    .onConflictDoUpdate({ target: [settings.profileId, settings.key], set: { value: String(id) } }).run()
}

export function findProfilePlaylist(db: DB, profileId: number, id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return undefined
  return db.select().from(playlists)
    .where(sql`${playlists.profileId} = ${profileId} AND ${playlists.id} = ${id}`).get()
}

export function getSelectedPlaylist(db: DB, profileId: number) {
  const saved = db.select().from(settings)
    .where(sql`${settings.profileId} = ${profileId} AND ${settings.key} = ${PLAYLIST_SELECTION_KEY}`).get()
  let playlist = findProfilePlaylist(db, profileId, Number(saved?.value))
  if (!playlist) {
    playlist = db.select().from(playlists).where(eq(playlists.profileId, profileId))
      .orderBy(asc(playlists.id)).get()
  }
  if (!playlist) {
    const now = Date.now()
    playlist = db.insert(playlists).values({ profileId, name: 'Default', createdAt: now, updatedAt: now }).returning().get()
  }
  if (saved?.value !== String(playlist.id)) setSelectedPlaylist(db, profileId, playlist.id)
  return playlist
}

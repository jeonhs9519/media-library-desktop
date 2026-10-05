import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerLegacyDatabaseIPC } from '../../src/main/ipc/legacyDatabase'
import { clearActiveProfileId, setActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => Promise<any>>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) } }))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let sqlite: Database.Database
let source: Database.Database
let directory: string
let filePath: string
const invoke = (name: string) => handlers.get(`legacyDatabase:${name}`)!({}, { filePath })
const rows = (table: string) => sqlite.prepare(`SELECT * FROM ${table}`).all() as any[]
const add = (database: Database.Database, id: number, profileId: number, name = 'shared') => database.prepare(`
  INSERT INTO items (id, profileId, filePath, fileName, fileExtension, title, contentType, containerType, createdAt, updatedAt)
  VALUES (?, ?, '/media', ?, 'pdf', 'Title', 'comic', 'pdf', 10, 20)
`).run(id, profileId, name)

beforeEach(() => {
  handlers.clear()
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-db-test-'))
  filePath = path.join(directory, 'source.db')
  const target = createDatabase(':memory:')
  const original = createDatabase(filePath)
  sqlite = target.sqlite
  source = original.sqlite
  for (const database of [target, original]) {
    runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
    ensureRuntimeSchema(database.sqlite)
  }
  setActiveProfileId(3)
  registerLegacyDatabaseIPC(target.db)
})
afterEach(() => {
  source.close()
  sqlite.close()
  clearActiveProfileId()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('legacy database profile restoration', () => {
  it('restores profiles and all current fields and remaps relationships independently of source ids', async () => {
    sqlite.exec("INSERT INTO profiles VALUES (4, 'Occupied', 1, 1), (7, 'Alice', 1, 1)")
    source.exec("INSERT INTO profiles VALUES (4, 'Alice', 11, 12), (5, 'Bob', 21, 22), (8, 'Empty', 31, 32)")
    for (const id of [3, 4, 5]) add(source, id, id)
    add(source, 9, 2, 'unassigned')
    source.exec(`UPDATE items SET sourceUrl = 'https://example.com', author = 'Author', memo = 'Memo',
      language = 'none', watched = 1, progress = 0.7, lastPageIndex = 7, bookViewMode = 'scroll',
      bookScrollZoom = 2, bookScrollOffset = 0.6, lastPositionSeconds = 12.5, totalContent = 100,
      thumbnail = X'010203', fileModifiedAt = 30 WHERE id = 5;
      INSERT INTO tags VALUES (10, 4, 'same'), (11, 5, 'same');
      INSERT INTO itemTags VALUES (4, 10), (5, 11);
      INSERT INTO reviews VALUES (1, 5, 4, 'Review', 10, 20);
      INSERT INTO playlists VALUES (20, 4, 'Reading', 10, 20), (21, 5, 'Reading', 30, 40);
      INSERT INTO playlistItems VALUES (20, 4, 2, 10), (21, 5, 3, 20);
      INSERT INTO settings VALUES (4, 'playlist.activeId', '20'), (5, 'playlist.activeId', '21'),
        (4, 'playlist.position', 'left'), (5, 'playlist.position', 'right'),
        (1, 'profile.lastActiveId', '5'), (1, 'profile.lastActiveIds', '[5,4]'), (1, 'ui.language', 'en');`)
    const before = rows('profiles')
    const preview = await invoke('preview')
    expect(preview).toMatchObject({ ok: true, stats: { importableItemCount: 4 } })
    expect(preview.items.map((item: any) => item.profileName)).toEqual(['GUEST', 'Alice', 'Bob', 'GUEST'])
    expect(rows('profiles')).toEqual(before)
    expect(await invoke('import')).toMatchObject({ ok: true, imported: 4, importedProfiles: 2, importedPlaylistItems: 2 })
    const bob = rows('profiles').find(row => row.name === 'Bob')
    expect(bob).toMatchObject({ createdAt: 21, updatedAt: 22 })
    expect(bob.id).not.toBe(5)
    expect(rows('items').map(row => row.profileId)).toEqual([3, 7, bob.id, 3])
    const imported = rows('items').find(row => row.profileId === bob.id)
    const original = source.prepare('SELECT * FROM items WHERE id = 5').get() as any
    expect(imported).toEqual({ ...original, id: imported.id, profileId: bob.id })
    expect(rows('reviews')).toEqual([expect.objectContaining({ itemId: imported.id, rating: 4, comment: 'Review', createdAt: 10, updatedAt: 20 })])
    for (const profileId of [7, bob.id]) {
      const item = rows('items').find(row => row.profileId === profileId)
      const tag = rows('tags').find(row => row.profileId === profileId)
      const playlist = rows('playlists').find(row => row.profileId === profileId)
      expect(rows('itemTags')).toContainEqual({ itemId: item.id, tagId: tag.id })
      expect(rows('playlistItems')).toContainEqual(expect.objectContaining({ itemId: item.id, playlistId: playlist.id }))
      expect(rows('settings')).toContainEqual({ profileId, key: 'playlist.activeId', value: String(playlist.id) })
    }
    expect(rows('settings')).toContainEqual({ profileId: 1, key: 'profile.lastActiveId', value: String(bob.id) })
    expect(rows('settings')).toContainEqual({ profileId: 1, key: 'profile.lastActiveIds', value: JSON.stringify([bob.id, 7]) })
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
    const snapshot = ['profiles', 'items', 'tags', 'itemTags', 'reviews', 'playlists', 'playlistItems', 'settings'].map(rows)
    expect(await invoke('import')).toMatchObject({ ok: true, imported: 0, skipped: 4, importedProfiles: 0 })
    expect(['profiles', 'items', 'tags', 'itemTags', 'reviews', 'playlists', 'playlistItems', 'settings'].map(rows)).toEqual(snapshot)
  })

  it('checks duplicates in the destination profile and preserves existing data and settings', async () => {
    sqlite.exec("INSERT INTO profiles VALUES (4, 'Bob', 1, 1); INSERT INTO settings VALUES (4, 'playlist.position', 'left')")
    source.exec("INSERT INTO profiles VALUES (5, 'Bob', 1, 1); INSERT INTO settings VALUES (5, 'playlist.position', 'right')")
    add(sqlite, 1, 3)
    add(sqlite, 2, 4)
    add(source, 1, 3)
    add(source, 2, 5)
    add(source, 3, 5, 'unique')
    expect(await invoke('preview')).toMatchObject({ stats: { duplicateItemCount: 2, importableItemCount: 1 } })
    expect(await invoke('import')).toMatchObject({ ok: true, skipped: 2, imported: 1 })
    expect(rows('settings')).toContainEqual({ profileId: 4, key: 'playlist.position', value: 'left' })
    expect(rows('items')).toHaveLength(3)
  })

  it('imports an empty profile and its settings without media items', async () => {
    source.exec("INSERT INTO profiles VALUES (5, 'Empty', 1, 2); INSERT INTO settings VALUES (5, 'playlist.position', 'left')")
    expect(await invoke('import')).toMatchObject({ ok: true, imported: 0, importedProfiles: 1, importedSettings: 1 })
    expect(rows('profiles')).toContainEqual(expect.objectContaining({ name: 'Empty' }))
  })

  it('imports a minimal pre-profile database using current defaults and empty optional values', async () => {
    source.close()
    fs.unlinkSync(filePath)
    source = new Database(filePath)
    source.exec(`CREATE TABLE items (id INTEGER, filePath TEXT, fileName TEXT, fileExtension TEXT, title TEXT);
      INSERT INTO items VALUES (1, '/old path ', 'book ', 'pdf', 'Old book');`)
    expect(await invoke('import')).toMatchObject({ ok: true, imported: 1 })
    expect(rows('items')[0]).toMatchObject({ profileId: 3, filePath: '/old path ', fileName: 'book ',
      contentType: 'book', containerType: 'pdf', language: 'unspecified', watched: 0, progress: 0,
      sourceUrl: null, author: null, memo: null, lastPageIndex: null, bookViewMode: null,
      bookScrollZoom: null, bookScrollOffset: null, lastPositionSeconds: null, totalContent: null,
      thumbnail: null, fileModifiedAt: null, createdAt: expect.any(Number), updatedAt: expect.any(Number) })
  })

  it('rolls back profile creation and data when a later write fails', async () => {
    source.exec("INSERT INTO profiles VALUES (5, 'Bob', 1, 1)")
    add(source, 1, 5)
    sqlite.exec("CREATE TRIGGER reject_item BEFORE INSERT ON items BEGIN SELECT RAISE(ABORT, 'test failure'); END")
    expect(await invoke('import')).toMatchObject({ ok: false, imported: 0 })
    expect(rows('profiles').find(row => row.name === 'Bob')).toBeUndefined()
    expect(rows('items')).toEqual([])
  })

  it('keeps empty text and falls back to empty values for unsupported viewer options', async () => {
    add(source, 1, 3)
    source.exec(`UPDATE items SET author = '', memo = '', sourceUrl = '', language = '',
      bookViewMode = 'unknown', bookScrollZoom = 4, bookScrollOffset = -1 WHERE id = 1`)
    expect(await invoke('import')).toMatchObject({ ok: true, imported: 1 })
    expect(rows('items')[0]).toMatchObject({ author: '', memo: '', sourceUrl: '', language: 'unspecified',
      bookViewMode: null, bookScrollZoom: null, bookScrollOffset: null })
  })

  it('rejects orphan profile references without assigning them to the current profile', async () => {
    source.pragma('foreign_keys = OFF')
    add(source, 1, 99)
    expect(await invoke('preview')).toMatchObject({ ok: false })
    expect(await invoke('import')).toMatchObject({ ok: false })
    expect(rows('items')).toEqual([])
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerPlaylistsIPC } from '../../src/main/ipc/playlists'
import { registerLegacyDatabaseIPC } from '../../src/main/ipc/legacyDatabase'
import { clearActiveProfileId, setActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => Promise<any>>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) } }))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let sqlite: Database.Database
let directory: string
const invoke = (name: string, payload?: any) => handlers.get(`playlists:${name}`)!({}, payload)
const create = (name: string, profileId = 3) => invoke('create', { name, profileId })
const entries = (playlistId: number) => invoke('getItems', { playlistId })

beforeEach(() => {
  handlers.clear()
  const database = createDatabase(':memory:')
  sqlite = database.sqlite
  runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
  ensureRuntimeSchema(sqlite)
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'playlists-test-'))
  sqlite.prepare('INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (4, ?, 1, 1)').run('Other')
  for (const id of [1, 2, 3, 4]) {
    sqlite.prepare(`INSERT INTO items (id, profileId, filePath, fileName, fileExtension, title, contentType, containerType, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'pdf', 'Book', 'book', 'pdf', 1, 1)`).run(id, id === 4 ? 4 : 3, directory, String(id))
    fs.writeFileSync(path.join(directory, `${id}.pdf`), '')
  }
  setActiveProfileId(3)
  registerPlaylistsIPC(database.db)
  registerLegacyDatabaseIPC(database.db)
})
afterEach(() => { sqlite.close(); clearActiveProfileId(); fs.rmSync(directory, { recursive: true, force: true }) })

describe('multiple profile playlists', () => {
  it('returns all item memberships in the active profile independently of the selected list', async () => {
    const first = (await invoke('getState')).selectedId
    const second = (await create('Second')).id
    const membership = (itemId: number) => invoke('getItemPlaylistIds', { itemId })
    expect(await membership(1)).toEqual([])
    await invoke('addItem', { itemId: 1, playlistId: first })
    await invoke('addItem', { itemId: 1, playlistId: second })
    expect(await membership(1)).toEqual([first, second])
    expect(await membership(2)).toEqual([])
    await invoke('select', { id: first, profileId: 3 })
    expect(await membership(1)).toEqual([first, second])
    await invoke('removeItem', { itemId: 1, playlistId: first })
    expect(await membership(1)).toEqual([second])
    await invoke('clear', { playlistId: second })
    expect(await membership(1)).toEqual([])
    setActiveProfileId(4)
    const foreign = (await create('Foreign', 4)).id
    await invoke('addItem', { itemId: 4, playlistId: foreign })
    expect(await membership(4)).toEqual([foreign])
    expect(await membership(1)).toEqual([])
    setActiveProfileId(3)
    expect(await membership(4)).toEqual([])
    expect(await membership(999)).toEqual([])
    expect(await membership(-1)).toEqual([])
  })

  it('preserves the existing Default id, membership and order when opening and renaming it', async () => {
    sqlite.exec("INSERT INTO playlists VALUES (10, 3, 'Default', 1, 1); INSERT INTO playlistItems VALUES (10, 2, 0, 1), (10, 1, 1, 1)")
    expect(await invoke('getState')).toMatchObject({ selectedId: 10, lists: [{ id: 10, name: 'Default', count: 2 }] })
    expect((await entries(10)).map((entry: any) => entry.itemId)).toEqual([2, 1])
    expect(await invoke('rename', { id: 10, name: ' Reading ', profileId: 3 })).toMatchObject({ ok: true })
    expect((await invoke('getDefault')).name).toBe('Reading')
    expect((await invoke('getState')).lists).toHaveLength(1)
    expect((await entries(10)).map((entry: any) => entry.itemId)).toEqual([2, 1])
  })

  it('keeps membership, counts and order independent and ignores duplicate button additions', async () => {
    const first = (await invoke('getState')).selectedId
    const second = (await create('Second')).id
    for (const id of [first, second]) {
      await invoke('addItem', { itemId: 1, playlistId: id })
      await invoke('addItem', { itemId: 2, playlistId: id })
    }
    await invoke('addItem', { itemId: 1, playlistId: first })
    expect((await entries(first)).map((row: any) => row.itemId)).toEqual([1, 2])
    await invoke('addItem', { itemId: 2, position: 0, playlistId: first })
    expect((await entries(first)).map((row: any) => row.itemId)).toEqual([2, 1])
    expect((await entries(second)).map((row: any) => row.itemId)).toEqual([1, 2])
    await invoke('removeItem', { itemId: 1, playlistId: first })
    expect((await invoke('getState')).lists.map((list: any) => list.count)).toEqual([1, 2])
    await invoke('clear', { playlistId: second })
    expect(await entries(second)).toEqual([])
    expect(await entries(first)).toHaveLength(1)
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM items').get()).toEqual({ count: 4 })
  })

  it('restores selection independently by profile and falls back if the saved id is stale or foreign', async () => {
    const first = (await invoke('getState')).selectedId
    const second = (await create('Second')).id
    expect((await invoke('getState')).selectedId).toBe(second)
    setActiveProfileId(4)
    const foreign = (await create('Second', 4)).id
    expect((await invoke('getState')).selectedId).toBe(foreign)
    setActiveProfileId(3)
    expect((await invoke('getState')).selectedId).toBe(second)
    sqlite.prepare("UPDATE settings SET value = ? WHERE profileId = 3 AND key = 'playlist.activeId'").run(String(foreign))
    expect((await invoke('getState')).selectedId).toBe(first)
    expect(sqlite.prepare("SELECT value FROM settings WHERE profileId = 3 AND key = 'playlist.activeId'").get()).toEqual({ value: String(first) })
    expect((await invoke('getState')).lists).toHaveLength(2)
  })

  it('deletes only playlist links, picks another list and protects the last list', async () => {
    const first = (await invoke('getState')).selectedId
    const second = (await create('Second')).id
    await invoke('addItem', { itemId: 1, playlistId: first })
    await invoke('addItem', { itemId: 1, playlistId: second })
    expect(await invoke('delete', { id: second, profileId: 3 })).toEqual({ ok: true })
    expect((await invoke('getState')).selectedId).toBe(first)
    expect(await entries(second)).toEqual([])
    expect(await entries(first)).toHaveLength(1)
    expect(await invoke('delete', { id: first, profileId: 3 })).toEqual({ ok: false, reason: 'last-playlist' })
    expect(fs.existsSync(path.join(directory, '1.pdf'))).toBe(true)
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM items').get()).toEqual({ count: 4 })
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
  })

  it('rejects empty and duplicate names but allows the same name in different profiles', async () => {
    const first = (await create('Reading')).id
    const second = (await create('Other')).id
    expect(await create(' Reading ')).toMatchObject({ ok: false, reason: 'duplicate-name' })
    expect(await create('  ')).toMatchObject({ ok: false, reason: 'invalid-name' })
    expect(await create('x'.repeat(101))).toMatchObject({ ok: false, reason: 'invalid-name' })
    expect(await invoke('rename', { id: second, name: 'Reading', profileId: 3 })).toMatchObject({ ok: false, reason: 'duplicate-name' })
    expect(await invoke('rename', { id: first, name: 'Reading', profileId: 3 })).toMatchObject({ ok: true })
    setActiveProfileId(4)
    expect(await create('Reading', 4)).toMatchObject({ ok: true })
  })

  it('allows deleting the original Default without recreating it', async () => {
    const original = (await invoke('getState')).selectedId
    const other = (await create('Retained')).id
    expect(await invoke('delete', { id: original, profileId: 3 })).toEqual({ ok: true })
    expect((await invoke('getDefault')).id).toBe(other)
    expect((await invoke('getState')).lists).toEqual([{ id: other, name: 'Retained', count: 0 }])
  })

  it('rejects foreign lists and stale profile actions without touching either profile', async () => {
    const local = (await invoke('getState')).selectedId
    setActiveProfileId(4)
    const foreign = (await create('Foreign', 4)).id
    await invoke('addItem', { itemId: 4, playlistId: foreign })
    setActiveProfileId(3)
    expect(await entries(foreign)).toEqual([])
    for (const action of ['select', 'delete', 'rename']) {
      expect(await invoke(action, { id: foreign, name: 'Changed', profileId: 3 })).toMatchObject({ ok: false, reason: 'not-found' })
      expect(await invoke(action, { id: local, name: 'Changed', profileId: 4 })).toMatchObject({ ok: false, reason: 'profile-changed' })
    }
    for (const action of ['addItem', 'removeItem', 'clear', 'reorderItems']) {
      expect(await invoke(action, { itemId: 1, itemIds: [1], playlistId: foreign })).toMatchObject({ ok: false, reason: 'not-found' })
    }
    expect(await invoke('addItem', { itemId: 4, playlistId: local })).toMatchObject({ ok: false, reason: 'missing-item' })
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM playlistItems WHERE playlistId = ?').get(foreign)).toEqual({ count: 1 })
  })

  it('reorders only the requested list and retains omitted items without foreign additions', async () => {
    const first = (await invoke('getState')).selectedId
    const second = (await create('Second')).id
    for (const id of [first, second]) for (const itemId of [1, 2, 3]) await invoke('addItem', { itemId, playlistId: id })
    await invoke('reorderItems', { itemIds: [3, 3, 4, 1], playlistId: first })
    expect((await entries(first)).map((row: any) => row.itemId)).toEqual([3, 1, 2])
    expect((await entries(second)).map((row: any) => row.itemId)).toEqual([1, 2, 3])
  })

  it('rolls back deletion and selection when deleting the list fails', async () => {
    await invoke('getState')
    const second = (await create('Second')).id
    await invoke('addItem', { itemId: 1, playlistId: second })
    sqlite.exec("CREATE TRIGGER reject_playlist_delete BEFORE DELETE ON playlists BEGIN SELECT RAISE(ABORT, 'test failure'); END")
    await expect(invoke('delete', { id: second, profileId: 3 })).rejects.toThrow('test failure')
    expect((await invoke('getState')).selectedId).toBe(second)
    expect(await entries(second)).toHaveLength(1)
  })

  it('imports multiple lists from a db file and remaps the selected playlist id', async () => {
    sqlite.exec("INSERT INTO playlists VALUES (1, 4, 'Foreign', 1, 1)")
    const filePath = path.join(directory, 'source.db')
    const source = new Database(filePath)
    source.exec(`CREATE TABLE items (id INTEGER, filePath TEXT, fileName TEXT, fileExtension TEXT, title TEXT);
      CREATE TABLE playlists (id INTEGER, name TEXT);
      CREATE TABLE playlistItems (playlistId INTEGER, itemId INTEGER, position INTEGER);
      CREATE TABLE settings (key TEXT, value TEXT);
      INSERT INTO items VALUES (10, '/import', 'one', 'pdf', 'One'), (11, '/import', 'two', 'pdf', 'Two');
      INSERT INTO playlists VALUES (1, 'First imported'), (2, 'Second imported');
      INSERT INTO playlistItems VALUES (1, 11, 0), (1, 10, 1), (2, 10, 0);
      INSERT INTO settings VALUES ('playlist.activeId', '1');`)
    source.close()
    const result = await handlers.get('legacyDatabase:import')!({}, { filePath })
    expect(result).toMatchObject({ ok: true, imported: 2, importedPlaylistItems: 3 })
    const state = await invoke('getState')
    expect(state.lists.map((list: any) => [list.name, list.count])).toEqual([['First imported', 2], ['Second imported', 1]])
    expect(state.selectedId).toBe(state.lists[0].id)
    expect(state.selectedId).not.toBe(1)
    expect((await entries(state.selectedId)).map((row: any) => row.item.title)).toEqual(['Two', 'One'])
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
  })
})

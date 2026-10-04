import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerProfilesIPC } from '../../src/main/ipc/profiles'
import { registerItemProfileMoveIPC } from '../../src/main/ipc/items/profileMove'
import { clearActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (_event: unknown, payload?: any) => Promise<any>>())
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: (_event: unknown, payload?: any) => Promise<any>) => handlers.set(name, handler) },
}))

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let sqlite: Database.Database

async function invoke(name: string, payload?: any) {
  const handler = handlers.get(name)
  if (!handler) throw new Error(`Missing IPC handler: ${name}`)
  return handler({}, payload)
}

function addProfile(id: number, name: string) {
  sqlite.prepare('INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (?, ?, 1, 1)').run(id, name)
}

function addItem(profileId: number, fileName: string, title = fileName) {
  return Number(sqlite.prepare(`
    INSERT INTO items (profileId, filePath, fileName, fileExtension, title, contentType, containerType, createdAt, updatedAt)
    VALUES (?, '/media', ?, 'pdf', ?, 'book', 'pdf', 1, 1)
  `).run(profileId, fileName, title).lastInsertRowid)
}

function addTag(profileId: number, itemId: number, name: string) {
  const tagId = Number(sqlite.prepare('INSERT INTO tags (profileId, name) VALUES (?, ?)').run(profileId, name).lastInsertRowid)
  sqlite.prepare('INSERT INTO itemTags (itemId, tagId) VALUES (?, ?)').run(itemId, tagId)
  return tagId
}

function addReview(itemId: number, comment: string) {
  sqlite.prepare('INSERT INTO reviews (itemId, rating, comment, createdAt, updatedAt) VALUES (?, 5, ?, 1, 1)').run(itemId, comment)
}

function addPlaylist(profileId: number, itemId: number) {
  const playlistId = Number(sqlite.prepare(
    'INSERT INTO playlists (profileId, name, createdAt, updatedAt) VALUES (?, ?, 1, 1)',
  ).run(profileId, 'Default').lastInsertRowid)
  sqlite.prepare('INSERT INTO playlistItems (playlistId, itemId, position, createdAt) VALUES (?, ?, 0, 1)').run(playlistId, itemId)
  return playlistId
}

function item(id: number) {
  return sqlite.prepare('SELECT * FROM items WHERE id = ?').get(id) as any
}

function tagNames(itemId: number) {
  return (sqlite.prepare(`
    SELECT tags.name FROM itemTags JOIN tags ON tags.id = itemTags.tagId WHERE itemTags.itemId = ?
  `).all(itemId) as Array<{ name: string }>).map((row) => row.name)
}

beforeEach(() => {
  handlers.clear()
  clearActiveProfileId()
  const database = createDatabase(':memory:')
  sqlite = database.sqlite
  runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
  ensureRuntimeSchema(sqlite)
  registerProfilesIPC(database.db)
  registerItemProfileMoveIPC(database.db)
  addProfile(4, 'Source')
  addProfile(5, 'Target')
})

afterEach(() => {
  sqlite.close()
  clearActiveProfileId()
})

describe('item profile move and copy', () => {
  it('copies item metadata, tags, and review while retaining the source', async () => {
    await invoke('profiles:select', { profileId: 4 })
    const sourceId = addItem(4, 'shared')
    sqlite.prepare("UPDATE items SET bookViewMode = 'scroll', bookScrollZoom = 2, bookScrollOffset = 0.6 WHERE id = ?").run(sourceId)
    addTag(4, sourceId, 'favorite')
    addReview(sourceId, 'source review')
    const targets = await invoke('items:getMoveTargets', { itemId: sourceId })
    expect(targets.targets.find((target: any) => target.id === 5).disabled).toBe(false)

    const copied = await invoke('items:copyToProfile', { itemId: sourceId, targetProfileId: 5 })
    expect(item(copied.itemId)).toMatchObject({ bookViewMode: 'scroll', bookScrollZoom: 2, bookScrollOffset: 0.6 })
    expect(copied.ok).toBe(true)
    expect(item(sourceId).profileId).toBe(4)
    expect(item(copied.itemId).profileId).toBe(5)
    expect(tagNames(copied.itemId)).toEqual(['favorite'])
    expect((sqlite.prepare('SELECT comment FROM reviews WHERE itemId = ?').get(copied.itemId) as any).comment).toBe('source review')
    expect((await invoke('items:getMoveTargets', { itemId: sourceId })).targets.find((target: any) => target.id === 5).reason).toBe('duplicate-file')
    expect((await invoke('items:moveToProfile', { itemId: sourceId, targetProfileId: 5 })).reason).toBe('duplicate-file')
  })

  it('moves an item and reconnects tags by name while removing source playlist references', async () => {
    await invoke('profiles:select', { profileId: 4 })
    const sourceId = addItem(4, 'movable')
    addTag(4, sourceId, 'favorite')
    const targetTagId = Number(sqlite.prepare('INSERT INTO tags (profileId, name) VALUES (5, ?)').run('favorite').lastInsertRowid)
    const playlistId = addPlaylist(4, sourceId)

    expect((await invoke('items:moveToProfile', { itemId: sourceId, targetProfileId: 5 })).ok).toBe(true)
    expect(item(sourceId).profileId).toBe(5)
    expect(tagNames(sourceId)).toEqual(['favorite'])
    expect((sqlite.prepare('SELECT tagId FROM itemTags WHERE itemId = ?').get(sourceId) as any).tagId).toBe(targetTagId)
    expect(sqlite.prepare('SELECT * FROM playlistItems WHERE playlistId = ?').all(playlistId)).toEqual([])
  })
})

describe('profile deletion', () => {
  it('keeps target duplicates and transfers unique source items', async () => {
    const sourceDuplicate = addItem(4, 'same', 'Source title')
    const targetDuplicate = addItem(5, 'same', 'Target title')
    const unique = addItem(4, 'unique')
    addTag(4, unique, 'new tag')
    addReview(sourceDuplicate, 'discarded review')
    addReview(targetDuplicate, 'kept review')

    const result = await invoke('profiles:delete', {
      profileId: 4, mode: 'transfer', targetProfileId: 5, duplicateStrategy: 'target',
    })
    expect(result).toMatchObject({ ok: true, transferred: 1, keptDuplicates: 1 })
    expect(item(sourceDuplicate)).toBeUndefined()
    expect(item(targetDuplicate).title).toBe('Target title')
    expect(item(unique).profileId).toBe(5)
    expect(tagNames(unique)).toEqual(['new tag'])
    expect((sqlite.prepare('SELECT comment FROM reviews WHERE itemId = ?').get(targetDuplicate) as any).comment).toBe('kept review')
  })

  it('overwrites target duplicates and replaces target playlist references with source ids', async () => {
    const sourceId = addItem(4, 'same', 'Source title')
    const targetId = addItem(5, 'same', 'Target title')
    const playlistId = addPlaylist(5, targetId)
    addPlaylist(4, sourceId)
    addTag(4, sourceId, 'source tag')
    addReview(sourceId, 'source review')

    const result = await invoke('profiles:delete', {
      profileId: 4, mode: 'transfer', targetProfileId: 5, duplicateStrategy: 'source',
    })
    expect(result).toMatchObject({ ok: true, transferred: 1, overwritten: 1 })
    expect(item(targetId)).toBeUndefined()
    expect(item(sourceId).profileId).toBe(5)
    expect(tagNames(sourceId)).toEqual(['source tag'])
    expect((sqlite.prepare('SELECT comment FROM reviews WHERE itemId = ?').get(sourceId) as any).comment).toBe('source review')
    expect(sqlite.prepare('SELECT itemId FROM playlistItems WHERE playlistId = ?').all(playlistId)).toEqual([{ itemId: sourceId }])
    expect((sqlite.prepare('SELECT count(*) AS count FROM playlists WHERE profileId = 4').get() as any).count).toBe(0)
  })

  it('deletes profile data and relations in delete mode', async () => {
    const sourceId = addItem(4, 'delete-me')
    addTag(4, sourceId, 'obsolete')
    addReview(sourceId, 'obsolete review')
    addPlaylist(4, sourceId)

    expect((await invoke('profiles:delete', { profileId: 4, mode: 'delete' })).ok).toBe(true)
    expect(item(sourceId)).toBeUndefined()
    expect(sqlite.prepare('SELECT * FROM profiles WHERE id = 4').get()).toBeUndefined()
    for (const table of ['tags', 'playlists']) {
      expect((sqlite.prepare(`SELECT count(*) AS count FROM ${table} WHERE profileId = 4`).get() as any).count).toBe(0)
    }
    expect(sqlite.prepare('SELECT * FROM reviews WHERE itemId = ?').all(sourceId)).toEqual([])
    expect(sqlite.prepare('SELECT * FROM itemTags WHERE itemId = ?').all(sourceId)).toEqual([])
    expect(sqlite.prepare('SELECT * FROM playlistItems WHERE itemId = ?').all(sourceId)).toEqual([])
  })
})

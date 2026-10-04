import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerTagsIPC } from '../../src/main/ipc/tags'
import { clearActiveProfileId, setActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => Promise<any>>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) } }))
let sqlite: Database.Database
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

beforeEach(() => {
  handlers.clear()
  const database = createDatabase(':memory:')
  sqlite = database.sqlite
  runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
  ensureRuntimeSchema(sqlite)
  sqlite.prepare('INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (4, ?, 1, 1)').run('Other')
  for (const id of [1, 2, 3]) {
    sqlite.prepare(`INSERT INTO items (id, profileId, filePath, fileName, fileExtension, title, contentType, containerType, createdAt, updatedAt)
      VALUES (?, ?, '/media', ?, 'pdf', 'Book', 'book', 'pdf', 1, 1)`).run(id, id === 3 ? 4 : 3, String(id))
  }
  setActiveProfileId(3)
  registerTagsIPC(database.db)
})
afterEach(() => { sqlite.close(); clearActiveProfileId() })

function tag(id: number, name: string, profileId = 3, itemIds = [1]) {
  sqlite.prepare('INSERT INTO tags (id, profileId, name) VALUES (?, ?, ?)').run(id, profileId, name)
  for (const itemId of itemIds) sqlite.prepare('INSERT INTO itemTags VALUES (?, ?)').run(itemId, id)
}
function rename(id: number, name: string, profileId = 3) {
  return handlers.get('tags:rename')!({}, { id, name, profileId })
}
function links() { return sqlite.prepare('SELECT * FROM itemTags ORDER BY itemId, tagId').all() }

describe('profile tag rename and merge', () => {
  it('renames all linked items and preserves another profile with the same name', async () => {
    tag(1, 'Before', 3, [1, 2]); tag(2, 'After', 4, [3])
    const before = links()
    expect(await rename(1, ' After ')).toMatchObject({ ok: true, id: 1, name: 'After', removedId: null })
    expect(links()).toEqual(before)
    expect(sqlite.prepare('SELECT name FROM tags WHERE id = 2').get()).toEqual({ name: 'After' })
    expect((await handlers.get('tags:getUsageCounts')!()).map((value: any) => value.name)).toEqual(['After'])
  })

  it.each([true, false])('keeps the smaller id when sourceIsOlder=%s and deduplicates shared items', async (sourceIsOlder) => {
    tag(1, sourceIsOlder ? 'Before' : 'After', 3, [1, 2])
    tag(2, sourceIsOlder ? 'After' : 'Before', 3, [1])
    tag(3, 'After', 4, [3])
    expect(await rename(sourceIsOlder ? 1 : 2, 'After')).toMatchObject({ ok: true, id: 1, removedId: 2, name: 'After' })
    expect(links()).toEqual([{ itemId: 1, tagId: 1 }, { itemId: 2, tagId: 1 }, { itemId: 3, tagId: 3 }])
    expect(sqlite.prepare('SELECT id, name FROM tags ORDER BY id').all()).toEqual([{ id: 1, name: 'After' }, { id: 3, name: 'After' }])
    expect(sqlite.pragma('foreign_key_check')).toEqual([])
  })

  it('rejects foreign tags and requests made after a profile switch', async () => {
    tag(1, 'Foreign', 4, [3])
    expect(await rename(1, 'Changed')).toMatchObject({ ok: false, reason: 'not-found' })
    tag(2, 'Local')
    setActiveProfileId(4)
    expect(await rename(2, 'Changed')).toMatchObject({ ok: false, reason: 'not-found' })
    expect(sqlite.prepare('SELECT name FROM tags ORDER BY id').all()).toEqual([{ name: 'Foreign' }, { name: 'Local' }])
  })

  it.each(['', '  ', '미지정', ' UNTAGGED ', '未指定'])('rejects invalid name %s without changing links', async (name) => {
    tag(1, 'Before')
    expect((await rename(1, name)).ok).toBe(false)
    expect(links()).toEqual([{ itemId: 1, tagId: 1 }])
    expect(sqlite.prepare('SELECT name FROM tags').get()).toEqual({ name: 'Before' })
  })

  it('preserves the tag and links for an unchanged name', async () => {
    tag(1, 'Same')
    expect(await rename(1, 'Same')).toMatchObject({ ok: true, id: 1, removedId: null })
    expect(links()).toEqual([{ itemId: 1, tagId: 1 }])
  })

  it('rolls back link changes and deletions if the final rename fails', async () => {
    tag(1, 'Before', 3, [1]); tag(2, 'After', 3, [2])
    const before = links()
    sqlite.exec("CREATE TRIGGER reject_tag_update BEFORE UPDATE ON tags BEGIN SELECT RAISE(ABORT, 'test failure'); END")
    await expect(rename(1, 'After')).rejects.toThrow('test failure')
    expect(links()).toEqual(before)
    expect(sqlite.prepare('SELECT name FROM tags ORDER BY id').all()).toEqual([{ name: 'Before' }, { name: 'After' }])
  })
})

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerItemImportIPC } from '../../src/main/ipc/items/imports'
import { registerItemRelinkIPC } from '../../src/main/ipc/items/relink'
import { clearActiveProfileId, setActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => Promise<any>>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) } }))
vi.mock('../../src/main/utils/thumbnail', () => ({ resizeToThumbnail: vi.fn(async (buffer: Buffer) => buffer) }))
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let sqlite: Database.Database
let directory: string
const invoke = (name: string, payload?: any) => handlers.get(`items:${name}`)!({}, payload)
const rows = () => sqlite.prepare('SELECT * FROM items ORDER BY id').all()
function add(folder: string, name: string, profileId = 3) {
  return Number(sqlite.prepare(`INSERT INTO items
    (profileId, filePath, fileName, fileExtension, title, contentType, containerType, createdAt, updatedAt)
    VALUES (?, ?, ?, 'pdf', ?, 'book', 'pdf', 1, 1)`).run(profileId, folder, name, name).lastInsertRowid)
}
function hdt(name: string, content: unknown) {
  const file = path.join(directory, name)
  fs.writeFileSync(file, JSON.stringify(content))
  return file
}
const preview = (filePaths: string[]) => invoke('importHdtPreview', { filePaths })
const apply = (selectedIds: string[]) => invoke('importHdtApply', { selectedIds })

beforeEach(() => {
  handlers.clear()
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'import-relink-test-'))
  const database = createDatabase(':memory:')
  sqlite = database.sqlite
  runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
  ensureRuntimeSchema(sqlite)
  sqlite.prepare('INSERT INTO profiles (id, name, createdAt, updatedAt) VALUES (4, ?, 1, 1)').run('Other')
  setActiveProfileId(3)
  registerItemImportIPC(database.db)
  registerItemRelinkIPC(database.db)
})
afterEach(() => { sqlite.close(); clearActiveProfileId(); fs.rmSync(directory, { recursive: true, force: true }) })

describe('relink data preservation', () => {
  it('updates nested paths only in the active profile and preserves metadata and relations', async () => {
    const from = path.join(directory, 'old')
    const to = path.join(directory, 'new')
    const first = add(from, 'first')
    const nested = add(path.join(from, 'child'), 'nested')
    add(`${from}-sibling`, 'outside')
    add(from, 'foreign', 4)
    sqlite.prepare('INSERT INTO tags (id, profileId, name) VALUES (1, 3, ?)').run('keep')
    sqlite.prepare('INSERT INTO itemTags VALUES (?, 1)').run(first)
    sqlite.prepare('INSERT INTO reviews (itemId, rating, comment, createdAt, updatedAt) VALUES (?, 4, ?, 1, 1)').run(first, 'keep review')
    sqlite.prepare('INSERT INTO playlists (id, profileId, name, createdAt, updatedAt) VALUES (1, 3, ?, 1, 1)').run('Keep')
    sqlite.prepare('INSERT INTO playlistItems VALUES (1, ?, 0, 1)').run(first)
    const before = rows() as any[]
    expect(await invoke('countByFolderPrefix', { folderPath: from })).toBe(2)
    expect(await invoke('bulkRelinkFolder', { fromFolder: from, toFolder: to })).toEqual({ ok: true, updated: 2 })
    const after = rows() as any[]
    expect(after.find(row => row.id === first)).toEqual({ ...before[0], filePath: to, updatedAt: expect.any(Number) })
    expect(after.find(row => row.id === nested).filePath).toBe(path.join(to, 'child'))
    expect(after.slice(2)).toEqual(before.slice(2))
    expect(sqlite.prepare('SELECT * FROM itemTags').all()).toEqual([{ itemId: first, tagId: 1 }])
    expect(sqlite.prepare('SELECT comment FROM reviews').get()).toEqual({ comment: 'keep review' })
    expect(sqlite.prepare('SELECT itemId FROM playlistItems').get()).toEqual({ itemId: first })
  })
  it('rejects a collision discovered after another planned change without updating any rows', async () => {
    const from = path.join(directory, 'old')
    const to = path.join(directory, 'new')
    add(from, 'first')
    add(path.join(from, 'child'), 'collision')
    add(path.join(to, 'child'), 'collision')
    const before = rows()
    expect(await invoke('bulkRelinkFolder', { fromFolder: from, toFolder: to })).toMatchObject({
      ok: false, reason: 'duplicate', updated: 0,
      conflict: { targetPath: path.join(to, 'child', 'collision.pdf') },
    })
    expect(rows()).toEqual(before)
  })
  it('allows the same target path in a different profile', async () => {
    const from = path.join(directory, 'old')
    const to = path.join(directory, 'new')
    add(from, 'shared')
    add(to, 'shared', 4)
    expect(await invoke('bulkRelinkFolder', { fromFolder: from, toFolder: to })).toEqual({ ok: true, updated: 1 })
    expect((rows() as any[]).map(row => row.filePath)).toEqual([to, to])
  })
  it('leaves rows unchanged for blank, missing and equivalent source/target folders', async () => {
    const folder = path.join(directory, 'old')
    add(folder, 'first')
    const before = rows()
    for (const [fromFolder, toFolder] of [['', directory], [directory, ' '], [path.join(directory, 'missing'), directory], [folder, path.join(folder, '.')]]) {
      expect(await invoke('bulkRelinkFolder', { fromFolder, toFolder })).toEqual({ ok: true, updated: 0 })
      expect(rows()).toEqual(before)
    }
  })
  it('rejects a single-item duplicate without replacing either item', async () => {
    const first = add(directory, 'first')
    const duplicate = add(directory, 'second')
    const before = rows()
    expect(await invoke('relink', { id: first, newFilePath: path.join(directory, 'second.pdf') }))
      .toMatchObject({ ok: false, reason: 'duplicate', duplicate: { id: duplicate } })
    expect(rows()).toEqual(before)
  })
})

describe('HDT cancellation, invalid inputs and profile isolation', () => {
  it('ignores missing files, invalid JSON, wrong root values and other extensions', async () => {
    const invalid = path.join(directory, 'invalid.hdt')
    fs.writeFileSync(invalid, '{broken')
    const result = await preview([path.join(directory, 'missing.hdt'), invalid, hdt('object.hdt', {}), hdt('wrong.txt', [{ title: 'Wrong', name_zip: 'wrong.zip' }])])
    expect(result).toEqual({ items: [], stats: { rawTotal: 0, visibleTotal: 0, selectableTotal: 0 } })
    expect(rows()).toEqual([])
  })
  it('excludes untitled entries and disables invalid, missing-path and duplicate entries', async () => {
    add(directory, 'duplicate')
    const before = rows()
    const result = await preview([hdt('mixed.hdt', [null, { title: ' ' }, { title: 'No path' },
      { title: 'Duplicate', name_zip: 'duplicate.pdf' }, { title: 'Ready', name_zip: 'ready.zip', str_pixmap: 'not an image' }])])
    expect(result.stats).toEqual({ rawTotal: 5, visibleTotal: 4, selectableTotal: 1 })
    expect(result.items.map((item: any) => item.disabledReason)).toEqual(['invalid_entry', 'missing_path', 'duplicate', undefined])
    expect(result.items.at(-1).hasThumbnail).toBe(false)
    expect(await apply(result.items.map((item: any) => item.previewId))).toEqual({ added: 1, skipped: 3 })
    expect(rows()).toHaveLength(2)
    expect(rows()[0]).toEqual(before[0])
  })
  it('does not write on preview or empty apply and invalidates ids on the next preview', async () => {
    const file = hdt('ready.hdt', [{ title: 'Ready', name_zip: 'ready.zip' }])
    const first = await preview([file])
    expect(rows()).toEqual([])
    expect(await apply([])).toEqual({ added: 0, skipped: 0 })
    expect(await apply([first.items[0].previewId])).toEqual({ added: 0, skipped: 1 })
    const second = await preview([file])
    await preview([])
    expect(await apply([second.items[0].previewId])).toEqual({ added: 0, skipped: 1 })
    expect(rows()).toEqual([])
  })
  it('rechecks duplicates at apply and makes repeat apply harmless', async () => {
    const result = await preview([hdt('race.hdt', [{ title: 'First', name_zip: 'first.pdf' }, { title: 'Second', name_zip: 'second.pdf' }])])
    add(directory, 'first')
    const ids = result.items.map((item: any) => item.previewId)
    expect(await apply(ids)).toEqual({ added: 1, skipped: 1 })
    const before = rows()
    expect(await apply(ids)).toEqual({ added: 0, skipped: 2 })
    expect(rows()).toEqual(before)
  })
  it('discards a preview prepared in another profile without writing to either profile', async () => {
    const file = hdt('profile.hdt', [{ title: 'Private', name_zip: 'private.pdf' }])
    const result = await preview([file])
    setActiveProfileId(4)
    expect(await apply([result.items[0].previewId])).toEqual({ added: 0, skipped: 1 })
    expect(rows()).toEqual([])
    const fresh = await preview([file])
    expect(await apply([fresh.items[0].previewId])).toEqual({ added: 1, skipped: 0 })
    expect((rows()[0] as any).profileId).toBe(4)
  })
})

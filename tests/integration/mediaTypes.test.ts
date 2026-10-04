import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDatabase, ensureRuntimeSchema, runMigrations } from '../../src/main/db/migrate'
import { registerItemCoreIPC } from '../../src/main/ipc/items/core'
import { registerItemImportIPC } from '../../src/main/ipc/items/imports'
import { registerItemRelinkIPC } from '../../src/main/ipc/items/relink'
import { registerLegacyDatabaseIPC } from '../../src/main/ipc/legacyDatabase'
import { registerPlaylistsIPC } from '../../src/main/ipc/playlists'
import { clearActiveProfileId, setActiveProfileId } from '../../src/main/services/profileState'

const handlers = vi.hoisted(() => new Map<string, (_event: unknown, payload?: any) => Promise<any>>())
vi.mock('electron', () => ({
  ipcMain: { handle: (name: string, handler: (_event: unknown, payload?: any) => Promise<any>) => handlers.set(name, handler) },
}))
vi.mock('../../src/main/utils/thumbnail', () => ({
  generateThumbnailFromCbz: vi.fn(async () => null),
  resizeToThumbnail: vi.fn(async (buffer: Buffer) => buffer),
}))

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
let sqlite: Database.Database
let directory: string

async function invoke(name: string, payload?: any) {
  const handler = handlers.get(name)
  if (!handler) throw new Error(`Missing IPC handler: ${name}`)
  return handler({}, payload)
}

async function add(fileName: string, fileExtension: string, fields: Record<string, unknown> = {}) {
  return invoke('items:add', { filePath: directory, fileName, fileExtension, ...fields })
}

beforeEach(() => {
  handlers.clear()
  clearActiveProfileId()
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'media-types-test-'))
  const database = createDatabase(':memory:')
  sqlite = database.sqlite
  runMigrations(database.db, path.join(root, 'src/main/db/migrations'))
  ensureRuntimeSchema(sqlite)
  registerItemCoreIPC(database.db)
  registerItemImportIPC(database.db)
  registerItemRelinkIPC(database.db)
  registerLegacyDatabaseIPC(database.db)
  registerPlaylistsIPC(database.db)
})

afterEach(() => {
  sqlite.close()
  clearActiveProfileId()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('independent content and file types', () => {
  it('distinguishes unspecified and no-dialogue language, prevents clearing a set language, and scopes filters', async () => {
    const unspecified = await add('unspecified-language', 'pdf')
    const noDialogue = await add('no-dialogue', 'pdf', { language: 'none' })
    const korean = await add('korean', 'pdf', { language: 'ko' })
    const other = await add('other-language', 'pdf', { language: 'other' })
    setActiveProfileId(2)
    await add('foreign-profile', 'pdf')
    setActiveProfileId(3)
    expect(unspecified.language).toBe('unspecified')
    expect((await invoke('items:getAll', { language: 'unspecified' })).items.map((row: any) => row.id)).toEqual([unspecified.id])
    expect((await invoke('items:getAll', { language: 'none' })).items.map((row: any) => row.id)).toEqual([noDialogue.id])
    expect((await invoke('items:getAll', { language: 'ko' })).items.map((row: any) => row.id)).toEqual([korean.id])
    expect((await invoke('items:getAll', { language: 'other' })).items.map((row: any) => row.id)).toEqual([other.id])
    expect((await invoke('items:getAll', { language: '' })).total).toBe(4)
    await invoke('items:update', { id: korean.id, language: '' })
    expect((await invoke('items:getById', { id: korean.id })).language).toBe('ko')
    await invoke('items:update', { id: korean.id, language: 'none' })
    expect((await invoke('items:getAll', { language: 'none' })).items.map((row: any) => row.id).sort()).toEqual([noDialogue.id, korean.id].sort())
    await invoke('items:update', { id: noDialogue.id, language: 'unspecified' })
    expect((await invoke('items:getById', { id: noDialogue.id })).language).toBe('none')
    expect(sqlite.prepare('SELECT language FROM items WHERE id = ?').get(unspecified.id)).toEqual({ language: 'unspecified' })
  })

  it('converts legacy empty language values to unspecified during runtime schema checks', async () => {
    const item = await add('legacy-empty-language', 'pdf')
    sqlite.prepare("UPDATE items SET language = '' WHERE id = ?").run(item.id)
    ensureRuntimeSchema(sqlite)
    expect((await invoke('items:getById', { id: item.id })).language).toBe('unspecified')
  })

  it('defaults PDF/ZIP/CBZ to books and video files to videos', async () => {
    for (const [extension, contentType, containerType] of [
      ['PDF', 'book', 'pdf'], ['zip', 'book', 'zip'], ['cbz', 'book', 'zip'],
      ['MP4', 'video', 'video'], ['webm', 'video', 'video'], ['txt', 'other', 'other'],
    ]) {
      expect(await add(extension, extension)).toMatchObject({ contentType, containerType })
    }
  })

  it('preserves user classification while deriving file type from extension', async () => {
    const pdf = await add('comic-pdf', 'pdf', { contentType: 'comic', containerType: 'video' })
    expect(pdf).toMatchObject({ contentType: 'comic', containerType: 'pdf' })
    await invoke('items:update', { id: pdf.id, contentType: 'video', containerType: 'video', totalContent: 20, progress: 0.5 })
    expect(await invoke('items:getById', { id: pdf.id })).toMatchObject({ contentType: 'video', containerType: 'pdf', totalContent: 20, progress: 0.5 })
    const filtered = await invoke('items:getAll', { contentType: 'video' })
    expect(filtered.items.map((item: any) => item.id)).toEqual([pdf.id])
    expect((await invoke('items:getAll', { contentType: 'comic' })).total).toBe(0)
  })

  it('bases playlist support on file type, including other-classified ZIP files', async () => {
    const supported = await add('photos', 'zip', { contentType: 'other' })
    const unsupported = await add('notes', 'txt', { contentType: 'book' })
    expect(await invoke('playlists:addItem', { itemId: supported.id })).toMatchObject({ ok: true })
    expect(await invoke('playlists:addItem', { itemId: unsupported.id })).toMatchObject({ ok: false, reason: 'unsupported-type' })
  })

  it('updates file type on relink without changing user classification', async () => {
    const item = await add('old', 'pdf', { contentType: 'comic' })
    expect(await invoke('items:relink', { id: item.id, newFilePath: path.join(directory, 'new.mp4') })).toMatchObject({
      ok: true, item: { contentType: 'comic', containerType: 'video', fileExtension: 'mp4' },
    })
  })

  it('uses the same defaults and file detection for HDT imports', async () => {
    const hdtPath = path.join(directory, 'sample.hdt')
    fs.writeFileSync(hdtPath, JSON.stringify([
      { title: 'Photos', name_zip: 'photos.zip' },
      { title: 'Movie', anime: true, names: ['movie.mp4'] },
      { title: 'Misclassified source', anime: true, names: ['document.pdf'] },
    ]))
    const preview = await invoke('items:importHdtPreview', { filePaths: [hdtPath] })
    expect(preview.items.map((item: any) => item.contentType)).toEqual(['book', 'video', 'book'])
    expect(await invoke('items:importHdtApply', { selectedIds: preview.items.map((item: any) => item.previewId) })).toMatchObject({ added: 3 })
    const rows = sqlite.prepare('SELECT fileExtension, contentType, containerType FROM items ORDER BY id').all()
    expect(rows).toEqual([
      { fileExtension: 'zip', contentType: 'book', containerType: 'zip' },
      { fileExtension: 'mp4', contentType: 'video', containerType: 'video' },
      { fileExtension: 'pdf', contentType: 'book', containerType: 'pdf' },
    ])
  })

  it('keeps legacy content classifications and derives viewers from extensions', async () => {
    const legacyPath = path.join(directory, 'legacy.db')
    const legacy = new Database(legacyPath)
    try {
      legacy.exec(`
        CREATE TABLE items (id INTEGER PRIMARY KEY, filePath TEXT, fileName TEXT, fileExtension TEXT, title TEXT, contentType TEXT, containerType TEXT);
        INSERT INTO items VALUES (1, '/media', 'notice', 'pdf', 'Notice', 'video', 'video');
        INSERT INTO items VALUES (2, '/media', 'comic', 'zip', 'Comic', 'comic', 'zip');
        INSERT INTO items VALUES (3, '/media', 'photos', 'zip', 'Photos', '', 'zip');
      `)
    } finally {
      legacy.close()
    }
    expect(await invoke('legacyDatabase:import', { filePath: legacyPath })).toMatchObject({ ok: true, imported: 3 })
    expect(sqlite.prepare('SELECT contentType, containerType FROM items ORDER BY id').all()).toEqual([
      { contentType: 'video', containerType: 'pdf' },
      { contentType: 'comic', containerType: 'zip' },
      { contentType: 'book', containerType: 'zip' },
    ])
  })
})

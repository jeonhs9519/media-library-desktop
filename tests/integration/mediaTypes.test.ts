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
import { registerReviewsIPC } from '../../src/main/ipc/reviews'
import { registerTagsIPC } from '../../src/main/ipc/tags'
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
  registerReviewsIPC(database.db)
  registerTagsIPC(database.db)
})

afterEach(() => {
  sqlite.close()
  clearActiveProfileId()
  fs.rmSync(directory, { recursive: true, force: true })
})

describe('independent content and file types', () => {
  it('trims saved item text and preserves empty values, internal whitespace and omitted fields', async () => {
    const item = await add(' padded file name ', 'pdf', {
      title: ' \tTitle  text\n', author: ' Author ', memo: '\n  First line\n  second line \n', sourceUrl: ' https://example.com/ ',
    })
    expect(item).toMatchObject({ title: 'Title  text', author: 'Author', memo: 'First line\n  second line', sourceUrl: 'https://example.com/', fileName: ' padded file name ' })
    await invoke('items:update', { id: item.id, progress: 0.4 })
    expect(await invoke('items:getById', { id: item.id })).toMatchObject({ title: 'Title  text', author: 'Author' })
    await invoke('items:update', { id: item.id, title: '\t\n ', author: ' \u3000 ', memo: '\n\t ', sourceUrl: ' ' })
    expect(await invoke('items:getById', { id: item.id })).toMatchObject({ title: '', author: '', memo: '', sourceUrl: '' })
    expect(await add('blank-title', 'pdf', { title: ' ' })).toMatchObject({ title: '' })
    expect((await add('automatic-title', 'pdf')).title).toBe('automatic-title')
  })

  it('trims reviews on insert and update without removing internal whitespace', async () => {
    const item = await add('review-text', 'pdf')
    expect(await invoke('reviews:upsert', { itemId: item.id, rating: 4, comment: ' \n First  line\n  next line \t' }))
      .toMatchObject({ comment: 'First  line\n  next line' })
    await invoke('reviews:upsert', { itemId: item.id, rating: 5, comment: ' \t\n\u3000' })
    expect((await invoke('items:getById', { id: item.id })).review).toMatchObject({ rating: 5, comment: '' })
  })

  it('trims new tag names and rejects whitespace-only names before writing', async () => {
    const tag = await invoke('tags:create', { name: ' \tTag  name\u3000' })
    expect(tag.name).toBe('Tag  name')
    await expect(invoke('tags:create', { name: ' \t\n\u3000' })).rejects.toThrow('Tag name is required')
    expect(sqlite.prepare('SELECT name FROM tags').all()).toEqual([{ name: 'Tag  name' }])
  })

  it('stores book modes per item, rejects invalid modes and preserves them across runtime checks', async () => {
    const first = await add('first-mode', 'pdf')
    const second = await add('second-mode', 'zip')
    expect(first.bookViewMode).toBeNull()
    for (const bookViewMode of ['single', 'scroll', 'double-ltr', 'double-rtl']) {
      await invoke('items:update', { id: first.id, bookViewMode })
      expect((await invoke('items:getById', { id: first.id })).bookViewMode).toBe(bookViewMode)
    }
    expect((await invoke('items:getById', { id: second.id })).bookViewMode).toBeNull()
    await expect(invoke('items:update', { id: first.id, bookViewMode: 'invalid' })).rejects.toThrow('Invalid book view mode')
    await invoke('items:update', { id: first.id, bookScrollZoom: 1.5, bookScrollOffset: 0.42 })
    for (const fields of [{ bookScrollZoom: 0.2 }, { bookScrollZoom: 4 }, { bookScrollZoom: NaN }, { bookScrollOffset: -0.1 }, { bookScrollOffset: 1.1 }, { bookScrollOffset: Infinity }]) {
      await expect(invoke('items:update', { id: first.id, ...fields })).rejects.toThrow('Invalid book scroll')
    }
    ensureRuntimeSchema(sqlite)
    expect(await invoke('items:getById', { id: first.id })).toMatchObject({ bookViewMode: 'double-rtl', bookScrollZoom: 1.5, bookScrollOffset: 0.42 })
    setActiveProfileId(2)
    await invoke('items:update', { id: first.id, bookViewMode: 'single' })
    setActiveProfileId(3)
    expect((await invoke('items:getById', { id: first.id })).bookViewMode).toBe('double-rtl')
  })
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

import { ipcMain } from 'electron'
import { eq, and, sql, asc, desc } from 'drizzle-orm'
import { items, tags, itemTags, reviews } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { normalizeTitle, detectContentType, detectContainerType } from '../utils/titleNormalizer'
import { generateThumbnailFromCbz, resizeToThumbnail } from '../utils/thumbnail'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

type DB = BetterSQLite3Database<typeof schema>

type HdtPreparedItem = {
  previewId: string
  sourceFile: string
  filePath: string
  fileName: string
  fileExtension: string
  title: string
  sourceUrl?: string
  author?: string
  contentType: 'comic' | 'video'
  containerType: 'zip' | 'video'
  duplicate: boolean
  disabledReason?: 'missing_title' | 'missing_path' | 'invalid_entry' | 'duplicate'
  thumbnailBuffer?: Buffer
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function decodeBase64Image(input: unknown): Buffer | null {
  if (typeof input !== 'string') return null

  let base64 = input.trim()
  if (!base64) return null

  const dataUriMatch = base64.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/)
  if (dataUriMatch?.[1]) {
    base64 = dataUriMatch[1]
  }

  base64 = base64.replace(/\s+/g, '')
  if (!base64) return null
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) return null

  try {
    const buffer = Buffer.from(base64, 'base64')
    if (buffer.length === 0) return null
    if (!isImageBuffer(buffer)) return null
    return buffer
  } catch {
    return null
  }
}

function isImageBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true

  // GIF
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF89a') return true
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF87a') return true

  // WEBP: RIFF....WEBP
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true

  // BMP
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true

  return false
}

function resolveImportedPath(baseDir: string, rawPath: string): string {
  const normalized = rawPath.trim().replace(/[\\/]/g, path.sep)
  if (path.isAbsolute(normalized)) return normalized
  return path.resolve(baseDir, normalized)
}

export function registerItemsIPC(db: DB) {
  const hdtPreviewCache = new Map<string, HdtPreparedItem>()

  ipcMain.handle('items:getAll', async (_event, params: {
    search?: string
    contentType?: string
    language?: string
    watchedState?: 'unread' | 'inProgress' | 'completed'
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    page?: number
    perPage?: number
  } = {}) => {
    const { search, contentType, language, watchedState, sortBy = 'createdAt', sortDir = 'desc', page = 1, perPage = 50 } = params

    const conditions: ReturnType<typeof eq>[] = []

    if (search) {
      conditions.push(
        sql`(${items.title} LIKE ${'%' + search + '%'} OR ${items.fileName} LIKE ${'%' + search + '%'} OR ${items.author} LIKE ${'%' + search + '%'} OR ${items.memo} LIKE ${'%' + search + '%'})` as any
      )
    }
    if (contentType) conditions.push(eq(items.contentType, contentType))
    if (language) conditions.push(eq(items.language, language))
    if (watchedState === 'unread') {
      conditions.push(sql`(coalesce(${items.progress}, 0) <= 0 AND ${items.watched} = 0)` as any)
    }
    if (watchedState === 'inProgress') {
      conditions.push(sql`(coalesce(${items.progress}, 0) > 0 AND coalesce(${items.progress}, 0) < 0.9 AND ${items.watched} = 0)` as any)
    }
    if (watchedState === 'completed') {
      conditions.push(sql`(${items.watched} = 1 OR coalesce(${items.progress}, 0) >= 0.9)` as any)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = ({
      title: items.title,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      fileModifiedAt: items.fileModifiedAt,
    } as any)[sortBy] || items.createdAt

    const orderFn = sortDir === 'asc' ? asc : desc

    const total = db.select({ count: sql<number>`count(*)` })
      .from(items)
      .where(whereClause)
      .get()?.count ?? 0

    const offset = (page - 1) * perPage

    const query = db.select({
      id: items.id,
      filePath: items.filePath,
      fileName: items.fileName,
      fileExtension: items.fileExtension,
      title: items.title,
      contentType: items.contentType,
      containerType: items.containerType,
      language: items.language,
      watched: items.watched,
      progress: items.progress,
      author: items.author,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      fileModifiedAt: items.fileModifiedAt,
    })
      .from(items)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .limit(perPage)
      .offset(offset)
      .all()

    const result = query.map(item => ({
      ...item,
      fileExists: fs.existsSync(path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : '')))
    }))

    return { items: result, total }
  })

  ipcMain.handle('items:getById', async (_event, { id }: { id: number }) => {
    const item = db.select().from(items).where(eq(items.id, id)).get()
    if (!item) return null

    const itemTagRows = db.select({ tag: tags })
      .from(itemTags)
      .innerJoin(tags, eq(itemTags.tagId, tags.id))
      .where(eq(itemTags.itemId, id))
      .all()

    const review = db.select().from(reviews).where(eq(reviews.itemId, id)).get()

    return {
      ...item,
      tags: itemTagRows.map(r => r.tag),
      review: review || null,
      fileExists: fs.existsSync(path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : '')))
    }
  })

  ipcMain.handle('items:add', async (_event, data: {
    filePath: string
    fileName: string
    fileExtension: string
    title?: string
    sourceUrl?: string
    author?: string
    memo?: string
    contentType?: string
    containerType?: string
    language?: string
    fileModifiedAt?: number
  }) => {
    const now = Date.now()
    const ext = data.fileExtension
    const title = data.title || normalizeTitle(data.fileName)
    const contentType = (data.contentType || detectContentType(ext)) as 'book' | 'comic' | 'video' | 'other'
    const containerType = (data.containerType || detectContainerType(ext)) as 'pdf' | 'zip' | 'video' | 'other'

    const result = db.insert(items).values({
      filePath: data.filePath,
      fileName: data.fileName,
      fileExtension: ext,
      title,
      sourceUrl: data.sourceUrl,
      author: data.author,
      memo: data.memo,
      contentType,
      containerType,
      language: data.language || '',
      watched: 0,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      fileModifiedAt: data.fileModifiedAt,
    }).returning().get()

    if (containerType === 'video') {
      return result
    }

    if (containerType === 'zip') {
      try {
        const fullPath = path.join(data.filePath, data.fileName + (ext ? '.' + ext : ''))
        const thumb = await generateThumbnailFromCbz(fullPath)
        if (thumb) {
          db.update(items).set({ thumbnail: thumb }).where(eq(items.id, result.id)).run()
        }
      } catch (e) {
        console.error('Auto-thumbnail error:', e)
      }
    }

    return result
  })

  ipcMain.handle('items:update', async (_event, { id, ...fields }: { id: number; [key: string]: any }) => {
    const now = Date.now()

    if (fields.progress !== undefined && fields.progress >= 0.9) {
      fields.watched = 1
    }

    db.update(items).set({ ...fields, updatedAt: now }).where(eq(items.id, id)).run()
    return db.select().from(items).where(eq(items.id, id)).get()
  })

  ipcMain.handle('items:delete', async (_event, { id }: { id: number }) => {
    db.delete(items).where(eq(items.id, id)).run()
  })

  ipcMain.handle('items:relink', async (_event, { id, newFilePath }: { id: number; newFilePath: string }) => {
    const now = Date.now()
    const parsed = path.parse(newFilePath)
    const ext = parsed.ext.replace('.', '')
    db.update(items).set({
      filePath: parsed.dir,
      fileName: parsed.name,
      fileExtension: ext,
      updatedAt: now,
    }).where(eq(items.id, id)).run()
    return db.select().from(items).where(eq(items.id, id)).get()
  })

  ipcMain.handle('items:checkExists', async (_event, { filePath, fileName, fileExtension }: { filePath: string; fileName: string; fileExtension: string }) => {
    const existing = db.select().from(items)
      .where(and(eq(items.filePath, filePath), eq(items.fileName, fileName), eq(items.fileExtension, fileExtension)))
      .get()
    return !!existing
  })

  ipcMain.handle('items:importHdtPreview', async (_event, { filePaths }: { filePaths: string[] }) => {
    hdtPreviewCache.clear()

    const prepared: HdtPreparedItem[] = []
    let rawTotal = 0

    for (const hdtPath of filePaths || []) {
      if (path.extname(hdtPath).toLowerCase() !== '.hdt') continue

      let parsedRoot: unknown
      try {
        parsedRoot = JSON.parse(fs.readFileSync(hdtPath, 'utf-8'))
      } catch {
        continue
      }

      if (!Array.isArray(parsedRoot)) continue

      const baseDir = path.dirname(hdtPath)
      const sourceFile = path.basename(hdtPath)

      for (const entry of parsedRoot) {
        rawTotal++

        if (!isObject(entry)) {
          prepared.push({
            previewId: crypto.randomUUID(),
            sourceFile,
            filePath: '',
            fileName: '',
            fileExtension: '',
            title: '',
            contentType: 'comic',
            containerType: 'zip',
            duplicate: false,
            disabledReason: 'invalid_entry',
          })
          continue
        }

        const titleRaw = typeof entry.title === 'string' ? entry.title.trim() : ''
        const anime = Boolean(entry.anime)

        let relativePath = ''
        if (anime) {
          const names = Array.isArray(entry.names) ? entry.names : []
          relativePath = typeof names[0] === 'string' ? names[0] : ''
        } else {
          relativePath = typeof entry.name_zip === 'string' ? entry.name_zip : ''
        }

        if (!titleRaw) {
          // Omit title-less entries from preview entirely.
          continue
        }

        if (!relativePath.trim()) {
          prepared.push({
            previewId: crypto.randomUUID(),
            sourceFile,
            filePath: '',
            fileName: '',
            fileExtension: '',
            title: normalizeTitle(titleRaw),
            contentType: anime ? 'video' : 'comic',
            containerType: anime ? 'video' : 'zip',
            duplicate: false,
            disabledReason: 'missing_path',
          })
          continue
        }

        const resolvedPath = resolveImportedPath(baseDir, relativePath)
        const parsedPath = path.parse(resolvedPath)
        const filePath = parsedPath.dir
        const fileName = parsedPath.name
        const fileExtension = parsedPath.ext.replace(/^\./, '')

        const duplicate = !!db.select().from(items)
          .where(and(eq(items.filePath, filePath), eq(items.fileName, fileName), eq(items.fileExtension, fileExtension)))
          .get()

        const sourceUrl = typeof entry.url === 'string' && entry.url.trim() ? entry.url.trim() : undefined
        const author = typeof entry.artist === 'string' && entry.artist.trim() ? entry.artist.trim() : undefined
        const rawThumbnail = decodeBase64Image(entry.str_pixmap)

        const item: HdtPreparedItem = {
          previewId: crypto.randomUUID(),
          sourceFile,
          filePath,
          fileName,
          fileExtension,
          title: normalizeTitle(titleRaw),
          sourceUrl,
          author,
          contentType: anime ? 'video' : 'comic',
          containerType: anime ? 'video' : 'zip',
          duplicate,
          disabledReason: duplicate ? 'duplicate' : undefined,
          thumbnailBuffer: rawThumbnail ?? undefined,
        }

        prepared.push(item)
        hdtPreviewCache.set(item.previewId, item)
      }
    }

    const previewItems = prepared.map((item) => ({
      previewId: item.previewId,
      sourceFile: item.sourceFile,
      title: item.title,
      sourceUrl: item.sourceUrl,
      author: item.author,
      filePath: item.filePath,
      fileName: item.fileName,
      fileExtension: item.fileExtension,
      contentType: item.contentType,
      duplicate: item.duplicate,
      hasThumbnail: Boolean(item.thumbnailBuffer),
      thumbnailBase64: item.thumbnailBuffer?.toString('base64'),
      disabledReason: item.disabledReason,
    }))

    return {
      items: previewItems,
      stats: {
        rawTotal,
        visibleTotal: previewItems.length,
        selectableTotal: previewItems.filter((item) => !item.disabledReason).length,
      },
    }
  })

  ipcMain.handle('items:importHdtApply', async (_event, { selectedIds }: { selectedIds: string[] }) => {
    let added = 0
    let skipped = 0

    for (const previewId of selectedIds || []) {
      const item = hdtPreviewCache.get(previewId)
      if (!item || item.disabledReason) {
        skipped++
        continue
      }

      const duplicate = !!db.select().from(items)
        .where(and(eq(items.filePath, item.filePath), eq(items.fileName, item.fileName), eq(items.fileExtension, item.fileExtension)))
        .get()
      if (duplicate) {
        skipped++
        continue
      }

      let fileModifiedAt: number | undefined = undefined
      try {
        const fullPath = path.join(item.filePath, item.fileName + (item.fileExtension ? `.${item.fileExtension}` : ''))
        fileModifiedAt = fs.existsSync(fullPath) ? fs.statSync(fullPath).mtimeMs : undefined
      } catch {
        fileModifiedAt = undefined
      }

      const now = Date.now()
      const inserted = db.insert(items).values({
        filePath: item.filePath,
        fileName: item.fileName,
        fileExtension: item.fileExtension,
        title: item.title,
        sourceUrl: item.sourceUrl,
        author: item.author,
        contentType: item.contentType,
        containerType: item.containerType,
        language: '',
        watched: 0,
        progress: 0,
        createdAt: now,
        updatedAt: now,
        fileModifiedAt,
      }).returning().get()

      if (item.thumbnailBuffer) {
        try {
          const thumb = await resizeToThumbnail(item.thumbnailBuffer)
          db.update(items).set({ thumbnail: thumb, updatedAt: Date.now() }).where(eq(items.id, inserted.id)).run()
        } catch (e) {
          console.error('HDT thumbnail resize error:', e)
        }
      }

      added++
    }

    hdtPreviewCache.clear()
    return { added, skipped }
  })
}

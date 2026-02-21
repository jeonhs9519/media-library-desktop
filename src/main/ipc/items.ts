import { ipcMain } from 'electron'
import { eq, and, sql, asc, desc } from 'drizzle-orm'
import { items, tags, itemTags, reviews } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { normalizeTitle, detectContentType, detectContainerType } from '../utils/titleNormalizer'
import { generateThumbnailFromCbz } from '../utils/thumbnail'
import fs from 'fs'
import path from 'path'

type DB = BetterSQLite3Database<typeof schema>

export function registerItemsIPC(db: DB) {
  ipcMain.handle('items:getAll', async (_event, params: {
    search?: string
    contentType?: string
    language?: string
    watched?: boolean
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    page?: number
    perPage?: number
  } = {}) => {
    const { search, contentType, language, watched, sortBy = 'createdAt', sortDir = 'desc', page = 1, perPage = 50 } = params

    const conditions: ReturnType<typeof eq>[] = []

    if (search) {
      conditions.push(
        sql`(${items.title} LIKE ${'%' + search + '%'} OR ${items.fileName} LIKE ${'%' + search + '%'} OR ${items.author} LIKE ${'%' + search + '%'} OR ${items.memo} LIKE ${'%' + search + '%'})` as any
      )
    }
    if (contentType) conditions.push(eq(items.contentType, contentType))
    if (language) conditions.push(eq(items.language, language))
    if (watched !== undefined) conditions.push(eq(items.watched, watched ? 1 : 0))

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
}

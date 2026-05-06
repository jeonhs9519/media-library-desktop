import { ipcMain } from 'electron'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { itemTags, items, reviews, tags } from '../../db/schema'
import { cleanupUnusedTags } from '../../services/tagMaintenance'
import { getActiveProfileId } from '../../services/profileState'
import { normalizeTitle, detectContentType, detectContainerType } from '../../utils/titleNormalizer'
import { generateThumbnailFromCbz } from '../../utils/thumbnail'
import type { DB } from './utils'

export function registerItemCoreIPC(db: DB) {
  ipcMain.handle('items:getAll', async (_event, params: {
    search?: string
    contentType?: string
    language?: string
    watchedState?: 'unread' | 'inProgress' | 'completed'
    fileState?: 'normal' | 'missing'
    tagIds?: number[]
    untagged?: boolean
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    page?: number
    perPage?: number
  } = {}) => {
    const { search, contentType, language, watchedState, fileState, tagIds = [], untagged = false, sortBy = 'createdAt', sortDir = 'desc', page = 1, perPage = 50 } = params

    const activeProfileId = getActiveProfileId()
    const conditions: ReturnType<typeof eq>[] = [eq(items.profileId, activeProfileId)]
    const normalizedTagIds = Array.from(new Set(
      tagIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ))

    if (search) {
      conditions.push(
        sql`(${items.title} LIKE ${'%' + search + '%'} OR ${items.fileName} LIKE ${'%' + search + '%'} OR ${items.author} LIKE ${'%' + search + '%'} OR ${items.memo} LIKE ${'%' + search + '%'} OR ${items.sourceUrl} LIKE ${'%' + search + '%'})` as any
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
    if (untagged) {
      conditions.push(sql`NOT EXISTS (
        SELECT 1 FROM ${itemTags}
        INNER JOIN ${tags} ON ${tags.id} = ${itemTags.tagId}
        WHERE ${itemTags.itemId} = ${items.id}
          AND ${tags.profileId} = ${activeProfileId}
      )` as any)
    } else if (normalizedTagIds.length > 0) {
      conditions.push(sql`${items.id} IN (
        SELECT ${itemTags.itemId}
        FROM ${itemTags}
        INNER JOIN ${tags} ON ${tags.id} = ${itemTags.tagId}
        WHERE ${itemTags.tagId} IN (${sql.join(normalizedTagIds.map((id) => sql`${id}`), sql`, `)})
          AND ${tags.profileId} = ${activeProfileId}
        GROUP BY ${itemTags.itemId}
        HAVING count(DISTINCT ${itemTags.tagId}) = ${normalizedTagIds.length}
      )` as any)
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = ({
      title: items.title,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      fileModifiedAt: items.fileModifiedAt,
    } as any)[sortBy] || items.createdAt

    const orderFn = sortDir === 'asc' ? asc : desc

    const selectFields = {
      id: items.id,
      filePath: items.filePath,
      fileName: items.fileName,
      fileExtension: items.fileExtension,
      title: items.title,
      sourceUrl: items.sourceUrl,
      contentType: items.contentType,
      containerType: items.containerType,
      language: items.language,
      watched: items.watched,
      progress: items.progress,
      totalContent: items.totalContent,
      author: items.author,
      createdAt: items.createdAt,
      updatedAt: items.updatedAt,
      fileModifiedAt: items.fileModifiedAt,
    }
    const offset = (page - 1) * perPage

    if (!fileState) {
      const totalRow = db.select({ count: sql<number>`count(*)` })
        .from(items)
        .where(whereClause)
        .get()

      const pagedItems = db.select(selectFields)
        .from(items)
        .where(whereClause)
        .orderBy(orderFn(sortColumn))
        .limit(perPage)
        .offset(offset)
        .all()

      const result = pagedItems.map(item => ({
        ...item,
        fileExists: fs.existsSync(path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : '')))
      }))

      return { items: result, total: totalRow?.count ?? 0 }
    }

    const baseQuery = db.select(selectFields)
      .from(items)
      .where(whereClause)
      .orderBy(orderFn(sortColumn))
      .all()

    const withFileState = baseQuery.map(item => ({
      ...item,
      fileExists: fs.existsSync(path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : '')))
    }))

    const filteredByFileState = withFileState.filter((item) => fileState === 'missing'
      ? item.fileExists === false
      : item.fileExists === true)
    const total = filteredByFileState.length
    const result = filteredByFileState.slice(offset, offset + perPage)

    return { items: result, total }
  })

  ipcMain.handle('items:getById', async (_event, { id }: { id: number }) => {
    const item = db.select().from(items)
      .where(and(eq(items.id, id), eq(items.profileId, getActiveProfileId())))
      .get()
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
    const activeProfileId = getActiveProfileId()
    const ext = data.fileExtension
    const title = data.title || normalizeTitle(data.fileName)
    const contentType = (data.contentType || detectContentType(ext)) as 'book' | 'comic' | 'video' | 'other'
    const containerType = (data.containerType || detectContainerType(ext)) as 'pdf' | 'zip' | 'video' | 'other'

    const result = db.insert(items).values({
      filePath: data.filePath,
      profileId: activeProfileId,
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

    db.update(items)
      .set({ ...fields, updatedAt: now })
      .where(and(eq(items.id, id), eq(items.profileId, getActiveProfileId())))
      .run()
    return db.select().from(items).where(eq(items.id, id)).get()
  })

  ipcMain.handle('items:delete', async (_event, { id }: { id: number }) => {
    db.delete(items).where(and(eq(items.id, id), eq(items.profileId, getActiveProfileId()))).run()
    return cleanupUnusedTags(db)
  })

  ipcMain.handle('items:checkExists', async (_event, { filePath, fileName, fileExtension }: { filePath: string; fileName: string; fileExtension: string }) => {
    const existing = db.select().from(items)
      .where(and(
        eq(items.profileId, getActiveProfileId()),
        eq(items.filePath, filePath),
        eq(items.fileName, fileName),
        eq(items.fileExtension, fileExtension),
      ))
      .get()
    return !!existing
  })
}

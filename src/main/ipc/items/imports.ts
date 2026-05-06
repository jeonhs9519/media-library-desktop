import { ipcMain } from 'electron'
import { and, eq } from 'drizzle-orm'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { items } from '../../db/schema'
import { getActiveProfileId } from '../../services/profileState'
import { normalizeTitle } from '../../utils/titleNormalizer'
import { resizeToThumbnail } from '../../utils/thumbnail'
import {
  decodeBase64Image,
  isObject,
  resolveImportedPath,
  type DB,
  type HdtPreparedItem,
} from './utils'

export function registerItemImportIPC(db: DB) {
  const hdtPreviewCache = new Map<string, HdtPreparedItem>()

  ipcMain.handle('items:importHdtPreview', async (_event, { filePaths }: { filePaths: string[] }) => {
    hdtPreviewCache.clear()
    const activeProfileId = getActiveProfileId()

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
          .where(and(
            eq(items.profileId, activeProfileId),
            eq(items.filePath, filePath),
            eq(items.fileName, fileName),
            eq(items.fileExtension, fileExtension),
          ))
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
    const activeProfileId = getActiveProfileId()

    for (const previewId of selectedIds || []) {
      const item = hdtPreviewCache.get(previewId)
      if (!item || item.disabledReason) {
        skipped++
        continue
      }

      const duplicate = !!db.select().from(items)
        .where(and(
          eq(items.profileId, activeProfileId),
          eq(items.filePath, item.filePath),
          eq(items.fileName, item.fileName),
          eq(items.fileExtension, item.fileExtension),
        ))
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
        profileId: activeProfileId,
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

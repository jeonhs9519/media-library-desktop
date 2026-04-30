import { ipcMain } from 'electron'
import { and, eq, ne } from 'drizzle-orm'
import path from 'path'
import { items } from '../../db/schema'
import {
  buildItemFullPath,
  buildItemIdentityKey,
  isPathInsideFolder,
  normalizeFolderPathForCompare,
  type DB,
} from './utils'

export function registerItemRelinkIPC(db: DB) {
  ipcMain.handle('items:relink', async (_event, { id, newFilePath }: { id: number; newFilePath: string }) => {
    const now = Date.now()
    const parsed = path.parse(newFilePath)
    const ext = parsed.ext.replace('.', '')

    const duplicate = db.select({
      id: items.id,
      title: items.title,
      filePath: items.filePath,
      fileName: items.fileName,
      fileExtension: items.fileExtension,
    })
      .from(items)
      .where(and(
        ne(items.id, id),
        eq(items.filePath, parsed.dir),
        eq(items.fileName, parsed.name),
        eq(items.fileExtension, ext),
      ))
      .get()

    if (duplicate) {
      return {
        ok: false,
        reason: 'duplicate',
        targetPath: newFilePath,
        duplicate,
      }
    }

    try {
      db.update(items).set({
        filePath: parsed.dir,
        fileName: parsed.name,
        fileExtension: ext,
        updatedAt: now,
      }).where(eq(items.id, id)).run()
    } catch (error: any) {
      const message = String(error?.message || '')
      if (message.toLowerCase().includes('unique')) {
        const racedDuplicate = db.select({
          id: items.id,
          title: items.title,
          filePath: items.filePath,
          fileName: items.fileName,
          fileExtension: items.fileExtension,
        })
          .from(items)
          .where(and(
            ne(items.id, id),
            eq(items.filePath, parsed.dir),
            eq(items.fileName, parsed.name),
            eq(items.fileExtension, ext),
          ))
          .get()

        return {
          ok: false,
          reason: 'duplicate',
          targetPath: newFilePath,
          duplicate: racedDuplicate || null,
        }
      }
      return {
        ok: false,
        reason: 'error',
        message,
      }
    }

    return {
      ok: true,
      item: db.select().from(items).where(eq(items.id, id)).get(),
    }
  })

  ipcMain.handle('items:countByFolderPrefix', async (_event, { folderPath }: { folderPath: string }) => {
    if (!folderPath?.trim()) return 0

    const rows = db.select({ filePath: items.filePath }).from(items).all()
    return rows.filter((row) => isPathInsideFolder(row.filePath, folderPath)).length
  })

  ipcMain.handle('items:bulkRelinkFolder', async (_event, { fromFolder, toFolder }: { fromFolder: string; toFolder: string }) => {
    if (!fromFolder?.trim() || !toFolder?.trim()) {
      return { ok: true, updated: 0 }
    }

    const fromNormalized = path.normalize(path.resolve(fromFolder))
    const toNormalized = path.normalize(path.resolve(toFolder))
    const now = Date.now()

    const rows = db.select({
      id: items.id,
      title: items.title,
      filePath: items.filePath,
      fileName: items.fileName,
      fileExtension: items.fileExtension,
    }).from(items).all()
    const targets = rows.filter((row) => isPathInsideFolder(row.filePath, fromFolder))

    if (!targets.length) {
      return { ok: true, updated: 0 }
    }

    const identityMap = new Map<string, typeof rows[number]>()
    for (const row of rows) {
      const key = buildItemIdentityKey(row.filePath, row.fileName, row.fileExtension)
      identityMap.set(key, row)
    }

    const nextFolderById = new Map<number, string>()
    for (const row of targets) {
      const currentNormalized = path.normalize(path.resolve(row.filePath))
      const relative = path.relative(fromNormalized, currentNormalized)
      const nextFolderPath = relative ? path.join(toNormalized, relative) : toNormalized
      nextFolderById.set(row.id, nextFolderPath)
    }

    for (const row of targets) {
      const nextFolderPath = nextFolderById.get(row.id) || row.filePath
      const oldKey = buildItemIdentityKey(row.filePath, row.fileName, row.fileExtension)
      const nextKey = buildItemIdentityKey(nextFolderPath, row.fileName, row.fileExtension)

      if (oldKey === nextKey) {
        continue
      }

      const existingOld = identityMap.get(oldKey)
      if (existingOld?.id === row.id) {
        identityMap.delete(oldKey)
      }

      const occupied = identityMap.get(nextKey)
      if (occupied && occupied.id !== row.id) {
        return {
          ok: false,
          reason: 'duplicate',
          conflict: {
            movingTitle: row.title,
            movingPath: buildItemFullPath(row.filePath, row.fileName, row.fileExtension),
            targetPath: buildItemFullPath(nextFolderPath, row.fileName, row.fileExtension),
            existingTitle: occupied.title,
            existingPath: buildItemFullPath(occupied.filePath, occupied.fileName, occupied.fileExtension),
          },
          updated: 0,
        }
      }

      identityMap.set(nextKey, {
        ...row,
        filePath: nextFolderPath,
      })
    }

    let updated = 0
    for (const row of targets) {
      const nextFilePath = nextFolderById.get(row.id) || row.filePath

      if (normalizeFolderPathForCompare(nextFilePath) === normalizeFolderPathForCompare(row.filePath)) {
        continue
      }

      try {
        db.update(items)
          .set({ filePath: nextFilePath, updatedAt: now })
          .where(eq(items.id, row.id))
          .run()
        updated++
      } catch (error: any) {
        return {
          ok: false,
          reason: 'error',
          message: String(error?.message || ''),
          failedTarget: {
            movingTitle: row.title,
            movingPath: buildItemFullPath(row.filePath, row.fileName, row.fileExtension),
            targetPath: buildItemFullPath(nextFilePath, row.fileName, row.fileExtension),
          },
          updated,
        }
      }
    }

    return { ok: true, updated }
  })
}

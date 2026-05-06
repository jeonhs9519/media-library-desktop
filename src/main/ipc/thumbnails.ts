import { ipcMain } from 'electron'
import { and, eq } from 'drizzle-orm'
import { items } from '../db/schema'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { resizeToThumbnail } from '../utils/thumbnail'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import { getActiveProfileId } from '../services/profileState'

type DB = BetterSQLite3Database<typeof schema>

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export function registerThumbnailsIPC(db: DB) {
  ipcMain.handle('thumbnail:get', async (_event, { id }: { id: number }) => {
    const activeProfileId = getActiveProfileId()
    const item = db.select({ thumbnail: items.thumbnail }).from(items)
      .where(and(eq(items.id, id), eq(items.profileId, activeProfileId)))
      .get()
    if (!item?.thumbnail) return null
    return Buffer.from(item.thumbnail as Buffer).toString('base64')
  })

  ipcMain.handle('thumbnail:setFromPage', async (_event, { id, pageIndex }: { id: number; pageIndex: number }) => {
    const activeProfileId = getActiveProfileId()
    const item = db.select().from(items).where(and(eq(items.id, id), eq(items.profileId, activeProfileId))).get()
    if (!item) return

    const fullPath = path.join(item.filePath, item.fileName + (item.fileExtension ? '.' + item.fileExtension : ''))

    if (item.containerType === 'zip') {
      const data = fs.readFileSync(fullPath)
      const zip = await JSZip.loadAsync(data)
      const pages = Object.keys(zip.files)
        .filter(name => /\.(jpe?g|png|gif|webp)$/i.test(name) && !zip.files[name].dir)
        .sort(naturalSort)

      if (pageIndex < pages.length) {
        const imageData = await zip.files[pages[pageIndex]].async('arraybuffer')
        const thumb = await resizeToThumbnail(Buffer.from(imageData))
        db.update(items).set({ thumbnail: thumb, updatedAt: Date.now() })
          .where(and(eq(items.id, id), eq(items.profileId, activeProfileId)))
          .run()
      }
    }
  })

  ipcMain.handle('thumbnail:setFromImageData', async (_event, { id, base64 }: { id: number; base64: string }) => {
    const buffer = Buffer.from(base64, 'base64')
    const thumb = await resizeToThumbnail(buffer)
    db.update(items).set({ thumbnail: thumb, updatedAt: Date.now() })
      .where(and(eq(items.id, id), eq(items.profileId, getActiveProfileId())))
      .run()
  })

  ipcMain.handle('thumbnail:setFromTime', async (_event, { id }: { id: number }) => {
    console.log('Video thumbnail not yet implemented', id)
  })
}

import { ipcMain } from 'electron'
import { and, eq, sql } from 'drizzle-orm'
import { execFile } from 'child_process'
import fs from 'fs'
import ffprobeStatic from 'ffprobe-static'
import { items } from '../../db/schema'
import { getActiveProfileId } from '../../services/profileState'
import { buildItemFullPath, type DB } from './utils'

type MetadataCandidate = {
  id: number
  filePath: string
  fileName: string
  fileExtension: string
  containerType: 'pdf' | 'zip' | 'video' | 'other'
}

type MetadataFillStatus = {
  running: boolean
  queued: number
  processed: number
  updated: number
  failed: number
}

export function registerItemMetadataIPC(db: DB) {
  const metadataFillStatus: MetadataFillStatus = {
    running: false,
    queued: 0,
    processed: 0,
    updated: 0,
    failed: 0,
  }

  let ffprobeUnavailableLogged = false
  let disableVideoMetadataExtraction = false

  const runExecFile = (command: string, args: string[]) => {
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(command, args, { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          reject(error)
          return
        }
        resolve({ stdout, stderr })
      })
    })
  }

  const extractPdfPageCount = async (fullPath: string) => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as any
    const fileData = await fs.promises.readFile(fullPath)
    const uint8 = new Uint8Array(fileData)
    const loadingTask = pdfjs.getDocument({ data: uint8 })
    const doc = await loadingTask.promise
    const pages = doc.numPages as number
    doc.destroy()
    return pages
  }

  const extractVideoDurationSeconds = async (fullPath: string) => {
    const ffprobeTargetPath = process.platform === 'win32' && !fullPath.startsWith('\\\\?\\') && fullPath.length >= 240
      ? `\\\\?\\${fullPath}`
      : fullPath

    const ffprobePath = ffprobeStatic.path || 'ffprobe'
    const { stdout } = await runExecFile(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      ffprobeTargetPath,
    ])

    const value = Number.parseFloat((stdout || '').trim())
    return Number.isFinite(value) && value > 0 ? value : null
  }

  const processMetadataCandidate = async (item: MetadataCandidate) => {
    const fullPath = buildItemFullPath(item.filePath, item.fileName, item.fileExtension)
    if (!fs.existsSync(fullPath)) return false

    if (item.containerType === 'zip') {
      const JSZip = require('jszip') as typeof import('jszip')
      const data = await fs.promises.readFile(fullPath)
      const zip = await JSZip.loadAsync(data)
      const pages = Object.keys(zip.files)
        .filter(name => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name) && !zip.files[name].dir)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))

      if (pages.length > 0) {
        db.update(items).set({ totalContent: pages.length, updatedAt: Date.now() }).where(eq(items.id, item.id)).run()
        return true
      }
      return false
    }

    if (item.containerType === 'pdf') {
      const pages = await extractPdfPageCount(fullPath)
      if (pages > 0) {
        db.update(items).set({ totalContent: pages, updatedAt: Date.now() }).where(eq(items.id, item.id)).run()
        return true
      }
      return false
    }

    if (item.containerType === 'video') {
      if (disableVideoMetadataExtraction) return false

      try {
        const seconds = await extractVideoDurationSeconds(fullPath)
        if (seconds && seconds > 0) {
          db.update(items).set({ totalContent: seconds, updatedAt: Date.now() }).where(eq(items.id, item.id)).run()
          return true
        }
        return false
      } catch (e: any) {
        if (e?.code === 'ENOENT') {
          disableVideoMetadataExtraction = true
          if (!ffprobeUnavailableLogged) {
            ffprobeUnavailableLogged = true
            console.warn('Video metadata extraction skipped: ffprobe is unavailable or failed to start.', e)
          }
          return false
        }

        const message = String(e?.message || '')
        if (message.includes('No such file or directory')) {
          return false
        }

        if (!ffprobeUnavailableLogged) {
          ffprobeUnavailableLogged = true
          console.warn('Video metadata extraction skipped due to ffprobe error.', e)
        }
        return false
      }
    }

    return false
  }

  const scheduleMetadataFill = () => {
    if (metadataFillStatus.running) return

    metadataFillStatus.running = true
    metadataFillStatus.processed = 0
    metadataFillStatus.updated = 0
    metadataFillStatus.failed = 0

    const queue = db.select({
      id: items.id,
      filePath: items.filePath,
      fileName: items.fileName,
      fileExtension: items.fileExtension,
      containerType: items.containerType,
    })
      .from(items)
      .where(
        and(
          sql`${items.totalContent} IS NULL`,
          eq(items.profileId, getActiveProfileId()),
          sql`${items.containerType} IN ('zip', 'pdf', 'video')`
        )
      )
      .all() as MetadataCandidate[]

    metadataFillStatus.queued = queue.length

    if (queue.length === 0) {
      metadataFillStatus.running = false
      return
    }

    let cursor = 0

    const runNext = () => {
      if (cursor >= queue.length) {
        metadataFillStatus.running = false
        return
      }

      const candidate = queue[cursor]
      cursor += 1

      setTimeout(async () => {
        if (!candidate) {
          metadataFillStatus.running = false
          return
        }

        try {
          const updated = await processMetadataCandidate(candidate)
          if (updated) {
            metadataFillStatus.updated += 1
          }
        } catch (e) {
          metadataFillStatus.failed += 1
          console.error(`Failed to fill metadata for item ${candidate.id}:`, e)
        } finally {
          metadataFillStatus.processed += 1
          runNext()
        }
      }, 0)
    }

    runNext()
  }

  ipcMain.handle('items:fillMissingMetadata', async () => {
    scheduleMetadataFill()
    return { ...metadataFillStatus }
  })

  ipcMain.handle('items:getMetadataFillStatus', async () => {
    return { ...metadataFillStatus }
  })
}

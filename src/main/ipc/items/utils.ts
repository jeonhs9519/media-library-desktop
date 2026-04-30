import path from 'path'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

export type DB = BetterSQLite3Database<typeof schema>

export type HdtPreparedItem = {
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

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function decodeBase64Image(input: unknown): Buffer | null {
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

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF89a') return true
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF87a') return true
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true

  return false
}

export function resolveImportedPath(baseDir: string, rawPath: string): string {
  const normalized = rawPath.trim().replace(/[\\/]/g, path.sep)
  if (path.isAbsolute(normalized)) return normalized
  return path.resolve(baseDir, normalized)
}

export function normalizeFolderPathForCompare(input: string): string {
  const resolved = path.normalize(path.resolve(input)).replace(/[\\/]+$/, '')
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isPathInsideFolder(targetPath: string, folderPath: string): boolean {
  const target = normalizeFolderPathForCompare(targetPath)
  const folder = normalizeFolderPathForCompare(folderPath)
  return target === folder || target.startsWith(folder + path.sep)
}

export function buildItemFullPath(filePath: string, fileName: string, fileExtension: string): string {
  return path.join(filePath, `${fileName}${fileExtension ? `.${fileExtension}` : ''}`)
}

export function buildItemIdentityKey(filePath: string, fileName: string, fileExtension: string): string {
  const normalizedPath = normalizeFolderPathForCompare(filePath)
  const normalizedName = process.platform === 'win32' ? fileName.toLowerCase() : fileName
  const normalizedExt = process.platform === 'win32' ? fileExtension.toLowerCase() : fileExtension
  return `${normalizedPath}::${normalizedName}::${normalizedExt}`
}

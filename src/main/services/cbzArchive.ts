import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'

export type CbzPage = { data: Uint8Array; mimeType: string }

export class CbzArchive {
  private zip: JSZip | null
  private pending = new Map<number, Promise<CbzPage>>()
  readonly pages: string[]

  private constructor(zip: JSZip) {
    this.zip = zip
    this.pages = Object.keys(zip.files)
      .filter(name => /\.(jpe?g|png|gif|webp|bmp)$/i.test(name) && !zip.files[name].dir)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
  }

  static async open(filePath: string): Promise<CbzArchive> {
    return new CbzArchive(await JSZip.loadAsync(await fs.readFile(filePath)))
  }

  getPage(pageIndex: number): Promise<CbzPage> {
    if (!this.zip) return Promise.reject(new Error('ZIP viewer session is closed'))
    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= this.pages.length) {
      return Promise.reject(new Error('Page index out of range'))
    }
    const existing = this.pending.get(pageIndex)
    if (existing) return existing
    const name = this.pages[pageIndex]
    const extension = path.extname(name).toLowerCase()
    const mimeType = extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : `image/${extension.slice(1)}`
    const request = this.zip.files[name].async('uint8array').then(data => {
      if (!this.zip) throw new Error('ZIP viewer session is closed')
      return { data, mimeType }
    }).finally(() => this.pending.delete(pageIndex))
    this.pending.set(pageIndex, request)
    return request
  }

  dispose() {
    this.zip = null
    this.pending.clear()
  }
}

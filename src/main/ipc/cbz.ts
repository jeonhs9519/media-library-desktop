import { ipcMain } from 'electron'
import fs from 'fs'
import JSZip from 'jszip'

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function isImageFile(name: string): boolean {
  return /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)
}

export function registerCbzIPC() {
  ipcMain.handle('cbz:getPages', async (_event, { filePath }: { filePath: string }) => {
    const data = fs.readFileSync(filePath)
    const zip = await JSZip.loadAsync(data)
    const pages = Object.keys(zip.files)
      .filter(name => isImageFile(name) && !zip.files[name].dir)
      .sort(naturalSort)
    return pages
  })

  ipcMain.handle('cbz:getPage', async (_event, { filePath, pageIndex }: { filePath: string; pageIndex: number }) => {
    const data = fs.readFileSync(filePath)
    const zip = await JSZip.loadAsync(data)
    const pages = Object.keys(zip.files)
      .filter(name => isImageFile(name) && !zip.files[name].dir)
      .sort(naturalSort)

    if (pageIndex >= pages.length) throw new Error('Page index out of range')

    const imageData = await zip.files[pages[pageIndex]].async('arraybuffer')
    return Buffer.from(imageData).toString('base64')
  })
}

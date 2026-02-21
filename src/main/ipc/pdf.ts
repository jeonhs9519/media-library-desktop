import { ipcMain } from 'electron'
import fs from 'fs'

export function registerPdfIPC() {
  ipcMain.handle('pdf:load', async (_event, { filePath }: { filePath: string }) => {
    if (!fs.existsSync(filePath)) throw new Error('File not found')
    const stat = fs.statSync(filePath)
    return { fileSize: stat.size }
  })

  ipcMain.handle('pdf:readFile', async (_event, { filePath }: { filePath: string }) => {
    const buffer = fs.readFileSync(filePath)
    return buffer.toString('base64')
  })
}

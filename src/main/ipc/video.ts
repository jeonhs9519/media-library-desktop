import { ipcMain } from 'electron'

export function registerVideoIPC() {
  ipcMain.handle('video:getLocalUrl', async (_event, { filePath }: { filePath: string }) => {
    return `local-media://video?path=${encodeURIComponent(filePath)}`
  })
}

import { ipcMain } from 'electron'
import { pathToFileURL } from 'url'

export function registerVideoIPC() {
  ipcMain.handle('video:getLocalUrl', async (_event, { filePath }: { filePath: string }) => {
    return pathToFileURL(filePath).toString()
  })
}

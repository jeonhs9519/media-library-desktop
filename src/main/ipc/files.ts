import { ipcMain, dialog, shell } from 'electron'
import fs from 'fs'

function isWebUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function registerFilesIPC() {
  ipcMain.handle('file:open-dialog', async (_event, { filters }: { filters?: Electron.FileFilter[] } = {}) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: filters || [
        { name: 'Media Files', extensions: ['pdf', 'cbz', 'zip', 'mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('file:open-folder-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    return result.canceled || !result.filePaths.length ? null : result.filePaths[0]
  })

  ipcMain.handle('file:check-exists', async (_event, { filePath }: { filePath: string }) => {
    return fs.existsSync(filePath)
  })

  ipcMain.handle('file:read-stat', async (_event, { filePath }: { filePath: string }) => {
    try {
      const stat = fs.statSync(filePath)
      return { mtime: stat.mtimeMs }
    } catch {
      return null
    }
  })

  ipcMain.handle('file:open-external', async (_event, { filePath }: { filePath: string }) => {
    if (isWebUrl(filePath)) {
      await shell.openExternal(filePath)
      return
    }
    await shell.openPath(filePath)
  })

  ipcMain.handle('file:show-in-folder', (_event, { filePath }: { filePath: string }) => {
    shell.showItemInFolder(filePath)
  })
}

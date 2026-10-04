import { clipboard, ipcMain } from 'electron'

export function registerClipboardIPC() {
  ipcMain.handle('clipboard:readText', () => clipboard.readText())
}

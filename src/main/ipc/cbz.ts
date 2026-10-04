import { ipcMain, type WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { CbzArchive } from '../services/cbzArchive'

export function registerCbzIPC() {
  const sessions = new Map<number, { id: string; archive: Promise<CbzArchive> }>()
  const watched = new WeakSet<WebContents>()
  const close = (owner: number) => {
    const session = sessions.get(owner)
    sessions.delete(owner)
    if (session) void session.archive.then(archive => archive.dispose()).catch(() => {})
  }

  ipcMain.handle('cbz:open', async (event, { filePath }: { filePath: string }) => {
    const sender = event.sender
    if (!watched.has(sender)) {
      watched.add(sender)
      sender.once('destroyed', () => close(sender.id))
      sender.on('render-process-gone', () => close(sender.id))
      sender.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) close(sender.id)
      })
    }
    close(sender.id)
    const session = { id: randomUUID(), archive: CbzArchive.open(filePath) }
    sessions.set(sender.id, session)
    try {
      const archive = await session.archive
      if (sessions.get(sender.id) !== session) throw new Error('ZIP viewer session is closed')
      return { sessionId: session.id, pages: archive.pages }
    } catch (error) {
      if (sessions.get(sender.id) === session) close(sender.id)
      throw error
    }
  })

  ipcMain.handle('cbz:getPage', async (event, { sessionId, pageIndex }: { sessionId: string; pageIndex: number }) => {
    const session = sessions.get(event.sender.id)
    if (!session || session.id !== sessionId) throw new Error('ZIP viewer session is closed')
    return (await session.archive).getPage(pageIndex)
  })

  ipcMain.handle('cbz:close', async (event, { sessionId }: { sessionId: string }) => {
    if (sessions.get(event.sender.id)?.id === sessionId) close(event.sender.id)
  })
}

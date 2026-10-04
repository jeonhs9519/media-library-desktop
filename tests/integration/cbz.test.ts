import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CbzArchive } from '../../src/main/services/cbzArchive'
import { registerCbzIPC } from '../../src/main/ipc/cbz'

const handlers = vi.hoisted(() => new Map<string, (event: any, payload: any) => Promise<any>>())
vi.mock('electron', () => ({ ipcMain: { handle: (name: string, handler: any) => handlers.set(name, handler) } }))
let directory: string
let filePath: string
const archives: CbzArchive[] = []
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cbz-test-'))
  filePath = path.join(directory, 'book.zip')
  const zip = new JSZip()
  zip.file('10.webp', Buffer.from('ten'))
  zip.file('2.PNG', Buffer.from('two'))
  zip.file('1.jpg', Buffer.from('one'))
  zip.file('notes.txt', 'ignored')
  zip.folder('fake.png')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  handlers.clear()
})
afterEach(async () => {
  archives.splice(0).forEach(archive => archive.dispose())
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})
async function open() {
  const archive = await CbzArchive.open(filePath)
  archives.push(archive)
  return archive
}
function sender(id: number) { return Object.assign(new EventEmitter(), { id }) }
function invoke(owner: EventEmitter, name: string, payload: any) { return handlers.get(`cbz:${name}`)!({ sender: owner }, payload) }

describe('ZIP viewer sessions', () => {
  it('reads the archive once, naturally sorts images and sends binary data with its MIME type', async () => {
    const read = vi.spyOn(fs, 'readFile')
    const archive = await open()
    expect(archive.pages).toEqual(['1.jpg', '2.PNG', '10.webp'])
    expect(Buffer.from((await archive.getPage(1)).data).toString()).toBe('two')
    expect((await archive.getPage(1)).mimeType).toBe('image/png')
    expect((await archive.getPage(0)).mimeType).toBe('image/jpeg')
    await archive.getPage(2)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('joins duplicate in-flight requests and rejects invalid indices', async () => {
    const archive = await open()
    const first = archive.getPage(0)
    expect(archive.getPage(0)).toBe(first)
    await first
    for (const index of [-1, 3, 0.5, NaN]) await expect(archive.getPage(index)).rejects.toThrow('out of range')
  })

  it('rejects pending and subsequent requests after disposal', async () => {
    const archive = await open()
    const pending = archive.getPage(0)
    archive.dispose()
    await expect(pending).rejects.toThrow('closed')
    await expect(archive.getPage(0)).rejects.toThrow('closed')
  })

  it('isolates senders and prevents old cleanup from closing a replacement session', async () => {
    registerCbzIPC()
    const a = sender(1), b = sender(2)
    const first = await invoke(a, 'open', { filePath })
    await expect(invoke(b, 'getPage', { sessionId: first.sessionId, pageIndex: 0 })).rejects.toThrow('closed')
    const second = await invoke(a, 'open', { filePath })
    await invoke(a, 'close', { sessionId: first.sessionId })
    await expect(invoke(a, 'getPage', { sessionId: first.sessionId, pageIndex: 0 })).rejects.toThrow('closed')
    expect(Buffer.from((await invoke(a, 'getPage', { sessionId: second.sessionId, pageIndex: 0 })).data).toString()).toBe('one')
    await invoke(a, 'close', { sessionId: second.sessionId })
    await expect(invoke(a, 'getPage', { sessionId: second.sessionId, pageIndex: 0 })).rejects.toThrow('closed')
  })

  it('closes on reload, renderer crash and sender destruction', async () => {
    registerCbzIPC()
    const owner = sender(1)
    for (const event of ['did-start-navigation', 'render-process-gone', 'destroyed']) {
      const opened = await invoke(owner, 'open', { filePath })
      owner.emit(event, {}, '', false, true)
      await expect(invoke(owner, 'getPage', { sessionId: opened.sessionId, pageIndex: 0 })).rejects.toThrow('closed')
    }
  })

  it('does not close on in-page navigation and recovers from an invalid archive', async () => {
    registerCbzIPC()
    const owner = sender(1)
    await fs.writeFile(path.join(directory, 'invalid.zip'), 'invalid')
    await expect(invoke(owner, 'open', { filePath: path.join(directory, 'invalid.zip') })).rejects.toThrow()
    const opened = await invoke(owner, 'open', { filePath })
    owner.emit('did-start-navigation', {}, '', true, true)
    expect((await invoke(owner, 'getPage', { sessionId: opened.sessionId, pageIndex: 0 })).mimeType).toBe('image/jpeg')
    owner.emit('destroyed')
  })
})

// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useLibraryMetadataFill } from '../../src/renderer/src/components/Library/hooks/useLibraryMetadataFill'
import { useFileImport } from '../../src/renderer/src/components/Library/hooks/useFileImport'

const mocks = vi.hoisted(() => ({ status: vi.fn(), fill: vi.fn(), exists: vi.fn(), add: vi.fn(), dialog: vi.fn(), stat: vi.fn() }))
vi.mock('../../src/renderer/src/api', () => ({ api: {
  items: { getMetadataFillStatus: mocks.status, fillMissingMetadata: mocks.fill, checkExists: mocks.exists, add: mocks.add },
  file: { openDialog: mocks.dialog, readStat: mocks.stat },
} }))
const status = (running = false, updated = 0) => ({ running, updated, queued: 2, processed: running ? 0 : 2, failed: 0 })
let root: Root
let files: ReturnType<typeof useFileImport>
const load = vi.fn(async () => {})
function Harness({ total = 0, version = 0, reload = load }: { total?: number; version?: number; reload?: () => Promise<void> }) {
  useLibraryMetadataFill({ total, refreshVersion: version, loadItems: reload })
  files = useFileImport({ tr: key => key, loadItems: reload })
  return null
}
async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(React.createElement(Harness, props)))
}
async function poll() { await act(async () => { await vi.advanceTimersByTimeAsync(1000) }) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  mocks.status.mockResolvedValue(status())
  mocks.fill.mockResolvedValue(status())
  mocks.exists.mockResolvedValue(false)
  mocks.add.mockResolvedValue({ id: 1 })
  mocks.stat.mockResolvedValue({ mtime: 1 })
  document.body.innerHTML = '<div id="mount"></div>'
  root = createRoot(document.getElementById('mount')!)
})
afterEach(() => {
  act(() => root.unmount())
  expect(vi.getTimerCount()).toBe(0)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('keeps metadata polling across count or callback changes and refreshes once at completion', async () => {
  mocks.fill.mockResolvedValue(status(true))
  await render({ total: 1 })
  const latest = vi.fn(async () => {})
  await render({ total: 2, reload: latest })
  mocks.status.mockResolvedValue(status(false, 2))
  await poll()
  expect(mocks.fill).toHaveBeenCalledTimes(1)
  expect(load).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
})
it('starts a fresh metadata pass after new items arrive in a retained library', async () => {
  await render({ total: 1 })
  expect(mocks.fill).toHaveBeenCalledTimes(1)
  mocks.fill.mockResolvedValue(status(true))
  await render({ total: 3, version: 1 })
  mocks.status.mockResolvedValue(status(false, 2))
  await poll()
  expect(mocks.fill).toHaveBeenCalledTimes(2)
  expect(load).toHaveBeenCalledTimes(1)
})
it('waits for an existing queue and then rescans items imported during that queue', async () => {
  mocks.status.mockResolvedValueOnce(status(true)).mockResolvedValue(status(false, 1))
  mocks.fill.mockResolvedValue(status(true))
  await render({ total: 2, version: 1 })
  expect(mocks.fill).not.toHaveBeenCalled()
  await poll()
  expect(mocks.fill).toHaveBeenCalledTimes(1)
  expect(load).not.toHaveBeenCalled()
  await poll()
  expect(load).toHaveBeenCalledTimes(1)
})
it('fills new items even if the current search has no matching rows', async () => {
  mocks.fill.mockResolvedValue(status(false, 1))
  await render({ total: 0, version: 1 })
  expect(mocks.fill).toHaveBeenCalledTimes(1)
  expect(load).toHaveBeenCalledTimes(1)
})
it('does not refresh for a metadata pass with no changes and cancels polling on unmount', async () => {
  await render({ total: 1 })
  expect(load).not.toHaveBeenCalled()
  mocks.fill.mockResolvedValue(status(true))
  await render({ total: 1, version: 1 })
  await act(async () => root.render(null))
  mocks.status.mockResolvedValue(status(false, 1))
  await poll()
  expect(load).not.toHaveBeenCalled()
})
it('refreshes once after adding a batch of files', async () => {
  mocks.dialog.mockResolvedValue(['S:/books/first.pdf', 'S:/books/second.zip', 'S:/books/third.pdf'])
  await render()
  await act(async () => { await files.handleBrowseFiles() })
  expect(mocks.add).toHaveBeenCalledTimes(3)
  expect(load).toHaveBeenCalledTimes(1)
})
it('does not refresh when all files in a batch are duplicates', async () => {
  mocks.dialog.mockResolvedValue(['S:/books/first.pdf', 'S:/books/second.zip'])
  mocks.exists.mockResolvedValue(true)
  await render()
  await act(async () => { await files.handleBrowseFiles() })
  expect(mocks.add).not.toHaveBeenCalled()
  expect(load).not.toHaveBeenCalled()
})
it('refreshes successful additions even when a later file in the batch fails', async () => {
  mocks.dialog.mockResolvedValue(['S:/books/first.pdf', 'S:/books/second.zip'])
  mocks.add.mockResolvedValueOnce({ id: 1 }).mockRejectedValueOnce(new Error('failed'))
  await render()
  await act(async () => { await expect(files.handleBrowseFiles()).rejects.toThrow('failed') })
  expect(load).toHaveBeenCalledTimes(1)
})

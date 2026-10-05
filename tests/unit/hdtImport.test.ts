// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useHdtImport } from '../../src/renderer/src/components/Library/hooks/useHdtImport'

const mocks = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn(), dialog: vi.fn() }))
vi.mock('../../src/renderer/src/api', () => ({ api: {
  items: { importHdtPreview: mocks.preview, importHdtApply: mocks.apply },
  file: { openDialog: mocks.dialog, getPathForFile: (file: { name: string }) => file.name },
} }))
let root: Root
let hdt: ReturnType<typeof useHdtImport>
const load = vi.fn(async () => {})
const result = { items: [
  { previewId: 'ready', sourceFile: 'one.hdt', title: 'Ready' },
  { previewId: 'duplicate', sourceFile: 'one.hdt', title: 'Duplicate', disabledReason: 'duplicate' },
], stats: { rawTotal: 2, visibleTotal: 2, selectableTotal: 1 } }
function Harness() { hdt = useHdtImport({ tr: key => key, loadItems: load }); return null }
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.resetAllMocks()
  mocks.preview.mockResolvedValue(result)
  mocks.apply.mockResolvedValue({ added: 1, skipped: 0 })
  mocks.dialog.mockResolvedValue(['one.hdt'])
  document.body.innerHTML = '<div id="mount"></div>'
  root = createRoot(document.getElementById('mount')!)
  await act(async () => root.render(React.createElement(Harness)))
})
afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals() })

it('keeps canceled and wrong-extension selections from preparing or writing data', async () => {
  act(() => hdt.openHdtUploadModal())
  mocks.dialog.mockResolvedValueOnce([])
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  expect(hdt.hdtUploadModalOpen).toBe(true)
  mocks.dialog.mockResolvedValueOnce(['wrong.pdf'])
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  expect(hdt.hdtUploadNotice).toBe('modal.hdtUpload.invalidSelection')
  expect(mocks.preview).not.toHaveBeenCalled()
  expect(mocks.apply).not.toHaveBeenCalled()
})
it('reports an empty preview without opening the apply dialog', async () => {
  mocks.preview.mockResolvedValue({ items: [], stats: { rawTotal: 0, visibleTotal: 0, selectableTotal: 0 } })
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  expect(hdt.hdtUploadNotice).toBe('modal.hdtUpload.noPreview')
  expect(hdt.hdtModalOpen).toBe(false)
  expect(mocks.apply).not.toHaveBeenCalled()
})
it('selects ready entries only and discards selection when the preview is canceled', async () => {
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  expect(hdt.hdtSelectedIds).toEqual(['ready'])
  expect(hdt.groupedHdtPreviewItems).toHaveLength(1)
  act(() => hdt.closeHdtImport())
  expect(hdt.hdtModalOpen).toBe(false)
  expect(hdt.hdtSelectedIds).toEqual([])
  expect(hdt.groupedHdtPreviewItems).toEqual([])
  expect(mocks.apply).not.toHaveBeenCalled()
})
it('skips empty selections and refreshes only when selected entries were added', async () => {
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  act(() => hdt.handleClearHdtGroup(['ready']))
  await act(async () => { await hdt.handleApplyHdt() })
  expect(mocks.apply).not.toHaveBeenCalled()
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  mocks.apply.mockResolvedValueOnce({ added: 0, skipped: 1 })
  await act(async () => { await hdt.handleApplyHdt() })
  expect(load).not.toHaveBeenCalled()
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  await act(async () => { await hdt.handleApplyHdt() })
  expect(mocks.apply).toHaveBeenLastCalledWith(['ready'])
  expect(load).toHaveBeenCalledTimes(1)
})
it('releases busy state and retains the selection when apply fails', async () => {
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  mocks.apply.mockRejectedValueOnce(new Error('write failed'))
  await act(async () => { await expect(hdt.handleApplyHdt()).rejects.toThrow('write failed') })
  expect(hdt.hdtApplying).toBe(false)
  expect(hdt.hdtSelectedIds).toEqual(['ready'])
  expect(hdt.hdtModalOpen).toBe(true)
  expect(load).not.toHaveBeenCalled()
})
it('does not reopen a canceled upload dialog when a late preview returns', async () => {
  let resolve!: (value: typeof result) => void
  mocks.preview.mockImplementation(() => new Promise(done => { resolve = done }))
  act(() => hdt.openHdtUploadModal())
  let pending!: Promise<void>
  await act(async () => { pending = hdt.handleBrowseHdtFiles() })
  act(() => hdt.closeHdtUploadModal())
  await act(async () => { resolve(result); await pending })
  expect(hdt.isHdtModalOpen).toBe(false)
  expect(hdt.hdtSelectedIds).toEqual([])
})
it('does not refresh the previous library after apply completes following unmount', async () => {
  let resolve!: (value: { added: number; skipped: number }) => void
  mocks.apply.mockImplementation(() => new Promise(done => { resolve = done }))
  await act(async () => { await hdt.handleBrowseHdtFiles() })
  let pending!: Promise<void>
  await act(async () => { pending = hdt.handleApplyHdt() })
  act(() => root.render(null))
  await act(async () => { resolve({ added: 1, skipped: 0 }); await pending })
  expect(load).not.toHaveBeenCalled()
})

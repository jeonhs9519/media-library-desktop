// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Item } from '../../src/renderer/src/types'

let root: Root
let useThumbnails: typeof import('../../src/renderer/src/components/Library/hooks/useLibraryThumbnails').useLibraryThumbnails
let api: typeof import('../../src/renderer/src/api').api
let bridge: any
let result: Record<number, string>
const item = (id: number) => ({ id } as Item)
function Library({ items }: { items: Item[] }) {
  result = useThumbnails(items)
  return null
}
async function render(items: Item[]) {
  await act(async () => root.render(React.createElement(Library, { items })))
}
function deferred() {
  let resolve!: (value: string | null) => void
  let reject!: (error: Error) => void
  const promise = new Promise<string | null>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  bridge = {
    thumbnail: {
      get: vi.fn(async (id: number) => `thumb-${id}`),
      setFromPage: vi.fn(async () => {}),
      setFromImageData: vi.fn(async () => {}),
      setFromTime: vi.fn(async () => {}),
    },
    profiles: { select: vi.fn(async () => {}), clearSelection: vi.fn(async () => {}) },
    items: {},
  }
  ;(window as any).api = bridge
  api = (await import('../../src/renderer/src/api')).api
  useThumbnails = (await import('../../src/renderer/src/components/Library/hooks/useLibraryThumbnails')).useLibraryThumbnails
  document.body.innerHTML = '<div id="mount"></div>'
  root = createRoot(document.getElementById('mount')!)
})
afterEach(() => {
  act(() => root.unmount())
  vi.unstubAllGlobals()
})

it('reuses thumbnails immediately after leaving and returning to the library', async () => {
  await render([item(1), item(2)])
  expect(result).toEqual({ 1: 'data:image/jpeg;base64,thumb-1', 2: 'data:image/jpeg;base64,thumb-2' })
  await act(async () => root.render(null))
  act(() => root.render(React.createElement(Library, { items: [item(1), item(2)] })))
  expect(result[1]).toBe('data:image/jpeg;base64,thumb-1')
  expect(bridge.thumbnail.get).toHaveBeenCalledTimes(2)
})

it('keeps an in-flight ZIP thumbnail through list replacement and shares duplicate requests', async () => {
  const request = deferred()
  bridge.thumbnail.get.mockImplementationOnce(() => request.promise)
  await render([item(1), item(2)])
  await render([item(1), item(2), item(3)])
  const shared = api.thumbnail.get(1)
  await act(async () => { request.resolve('zip-cover'); await shared })
  expect(result[1]).toBe('data:image/jpeg;base64,zip-cover')
  expect(Object.keys(result)).toHaveLength(3)
  expect(bridge.thumbnail.get.mock.calls.filter(([id]: number[]) => id === 1)).toHaveLength(1)
})

it('retains a pending result when the page unmounts before it resolves', async () => {
  const request = deferred()
  bridge.thumbnail.get.mockImplementationOnce(() => request.promise)
  await render([item(1)])
  await act(async () => root.render(null))
  await act(async () => { request.resolve('cover'); await request.promise })
  await render([item(1)])
  expect(result[1]).toBe('data:image/jpeg;base64,cover')
  expect(bridge.thumbnail.get).toHaveBeenCalledTimes(1)
})

it('refreshes only the thumbnail changed in the viewer', async () => {
  await render([item(1), item(2)])
  bridge.thumbnail.get.mockImplementation(async (id: number) => `new-${id}`)
  await act(async () => { await api.thumbnail.setFromPage(1, 2) })
  expect(result[1]).toBe('data:image/jpeg;base64,new-1')
  expect(result[2]).toBe('data:image/jpeg;base64,thumb-2')
  expect(bridge.thumbnail.get).toHaveBeenCalledTimes(3)
})

it('does not let a response from the old profile overwrite the new profile cache', async () => {
  const request = deferred()
  bridge.thumbnail.get.mockImplementationOnce(() => request.promise)
  const old = api.thumbnail.get(1)
  await api.profiles.select(4)
  await render([item(1)])
  await act(async () => { request.resolve('old-profile'); await old })
  expect(result[1]).toBe('data:image/jpeg;base64,thumb-1')
})

it('caches missing thumbnails and permits a failed request to be retried', async () => {
  bridge.thumbnail.get.mockResolvedValueOnce(null)
  expect(await api.thumbnail.get(1)).toBeNull()
  expect(await api.thumbnail.get(1)).toBeNull()
  bridge.thumbnail.get.mockRejectedValueOnce(new Error('temporary'))
  await expect(api.thumbnail.get(2)).rejects.toThrow('temporary')
  expect(await api.thumbnail.get(2)).toBe('thumb-2')
  expect(bridge.thumbnail.get).toHaveBeenCalledTimes(3)
})

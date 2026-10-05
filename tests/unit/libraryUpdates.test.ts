import { expect, it, vi } from 'vitest'
import { needsLibraryReload, patchLibraryItem, publishLibraryUpdate, subscribeLibraryUpdates } from '../../src/renderer/src/libraryUpdates'
import type { Item } from '../../src/renderer/src/types'

const item = { id: 1, progress: 0.2, watched: 0, updatedAt: 1, fileExists: true, title: 'book' } as Item
it('patches reading progress without retaining thumbnail blobs or losing file existence', () => {
  const updated = { ...item, progress: 0.5, thumbnail: Buffer.from('cover') }
  delete updated.fileExists
  expect(patchLibraryItem(item, updated)).toEqual({ ...item, progress: 0.5 })
})
it('keeps ordinary lists and unchanged progress filter membership', () => {
  const update = { id: 1, fields: { progress: 0.3 }, item: { ...item, progress: 0.3 } }
  expect(needsLibraryReload(update, item, 'all', 'createdAt')).toBe(false)
  expect(needsLibraryReload(update, item, 'inProgress', 'title')).toBe(false)
})
it('refreshes progress filter membership and updated-time ordering when reading changes them', () => {
  const update = { id: 1, fields: { progress: 1 }, item: { ...item, watched: 1, progress: 1 } }
  expect(needsLibraryReload(update, item, 'inProgress', 'createdAt')).toBe(true)
  expect(needsLibraryReload(update, undefined, 'completed', 'createdAt')).toBe(true)
  expect(needsLibraryReload(update, item, 'all', 'updatedAt')).toBe(true)
})
it('refreshes unknown metadata changes and handles thumbnail changes according to sorting', () => {
  expect(needsLibraryReload({ id: 1, fields: { title: 'new' } }, item, 'all', 'title')).toBe(true)
  expect(needsLibraryReload({ id: 1, fields: { thumbnail: true } }, item, 'all', 'createdAt')).toBe(false)
  expect(needsLibraryReload({ id: 1, fields: { thumbnail: true } }, item, 'all', 'updatedAt')).toBe(true)
})
it('delivers saved changes only to current subscribers', () => {
  const listener = vi.fn()
  const stop = subscribeLibraryUpdates(listener)
  const update = { id: 1, fields: { progress: 0.5 } }
  publishLibraryUpdate(update)
  stop()
  publishLibraryUpdate(update)
  expect(listener).toHaveBeenCalledExactlyOnceWith(update)
})

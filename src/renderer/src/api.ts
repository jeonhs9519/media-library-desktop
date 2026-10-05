import type { API } from '../../preload/index'
import { invalidateThumbnail, loadThumbnail } from './thumbnailCache'
import { publishLibraryUpdate } from './libraryUpdates'

const bridge = (window as Window & { api: API }).api

async function mutateThumbnail(id: number, action: () => Promise<any>) {
  const result = await action()
  invalidateThumbnail(id)
  return result
}

async function saveThumbnail(id: number, action: () => Promise<any>) {
  const result = await mutateThumbnail(id, action)
  publishLibraryUpdate({ id, fields: { thumbnail: true } })
  return result
}

async function changeProfile(action: () => Promise<any>) {
  invalidateThumbnail()
  try { return await action() } finally { invalidateThumbnail() }
}

export const api: API = {
  ...bridge,
  thumbnail: {
    ...bridge.thumbnail,
    get: (id) => loadThumbnail(id, () => bridge.thumbnail.get(id)),
    setFromPage: (id, page) => saveThumbnail(id, () => bridge.thumbnail.setFromPage(id, page)),
    setFromTime: (id, time) => saveThumbnail(id, () => bridge.thumbnail.setFromTime(id, time)),
    setFromImageData: (id, data) => saveThumbnail(id, () => bridge.thumbnail.setFromImageData(id, data)),
  },
  profiles: {
    ...bridge.profiles,
    clearSelection: () => changeProfile(() => bridge.profiles.clearSelection()),
    select: (...args) => changeProfile(() => bridge.profiles.select(...args)),
    createAndSelect: (...args) => changeProfile(() => bridge.profiles.createAndSelect(...args)),
    delete: (...args) => changeProfile(() => bridge.profiles.delete(...args)),
  },
  items: {
    ...bridge.items,
    update: async (id, fields) => {
      const item = await bridge.items.update(id, fields)
      if (item) publishLibraryUpdate({ id, fields, item })
      return item
    },
    delete: (id) => mutateThumbnail(id, () => bridge.items.delete(id)),
    moveToProfile: (id, profileId) => mutateThumbnail(id, () => bridge.items.moveToProfile(id, profileId)),
  },
}

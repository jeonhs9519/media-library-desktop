import { useEffect, useSyncExternalStore } from 'react'
import { api } from '../../../api'
import { getThumbnailRevision, peekThumbnail, subscribeThumbnails } from '../../../thumbnailCache'
import type { Item } from '../../../types'

export function useLibraryThumbnails(items: Item[]) {
  const revision = useSyncExternalStore(subscribeThumbnails, getThumbnailRevision)
  const ids = items.map((item) => item.id).join(',')

  useEffect(() => {
    let canceled = false

    const loadThumbnails = async () => {
      for (const id of ids ? ids.split(',').map(Number) : []) {
        if (canceled) return
        if (peekThumbnail(id) !== undefined) continue
        try {
          await api.thumbnail.get(id)
        } catch (error) {
          console.error('Thumbnail load error:', error)
        }
      }
    }

    void loadThumbnails()

    return () => {
      canceled = true
    }
  }, [ids, revision])

  const thumbnails: Record<number, string> = {}
  for (const item of items) {
    const value = peekThumbnail(item.id)
    if (value) thumbnails[item.id] = `data:image/jpeg;base64,${value}`
  }
  return thumbnails
}

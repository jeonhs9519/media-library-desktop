import { useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import type { Item } from '../../../types'

export function useLibraryThumbnails(items: Item[]) {
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const loadedThumbnailIds = useRef<Set<number>>(new Set())

  useEffect(() => {
    let canceled = false

    const loadThumbnails = async () => {
      for (const item of items) {
        if (canceled) return
        if (loadedThumbnailIds.current.has(item.id)) continue

        loadedThumbnailIds.current.add(item.id)
        const thumb = await api.thumbnail.get(item.id)
        if (thumb && !canceled) {
          setThumbnails((prev) => ({ ...prev, [item.id]: `data:image/jpeg;base64,${thumb}` }))
        }
      }
    }

    loadThumbnails()

    return () => {
      canceled = true
    }
  }, [items])

  return thumbnails
}

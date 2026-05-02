import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NavigateFunction } from 'react-router-dom'
import { api } from './api'
import { getPlaylistViewerPathAtOffset } from './playlistAutoAdvance'
import { useLibraryThumbnails } from './components/Library/hooks/useLibraryThumbnails'
import type { PlaylistItem } from './types'

export function useViewerPlaylist(itemId: number, navigate: NavigateFunction, returnTo: string) {
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [visible, setVisible] = useState(false)
  const thumbnails = useLibraryThumbnails(items.map((entry) => entry.item))

  const load = useCallback(async () => {
    const result = await api.playlists.getItems()
    setItems(result)
  }, [])

  useEffect(() => {
    load().catch(console.error)
  }, [load])

  useEffect(() => {
    api.settings.get('viewer.playlist.visible').then((value: string | undefined) => {
      setVisible(value === '1')
    })
  }, [])

  const available = items.length > 0
  const canGoPrevious = useMemo(
    () => Boolean(getPlaylistViewerPathAtOffset(items, itemId, -1)),
    [itemId, items],
  )
  const canGoNext = useMemo(
    () => Boolean(getPlaylistViewerPathAtOffset(items, itemId, 1)),
    [itemId, items],
  )

  const openAtOffset = useCallback((offset: -1 | 1) => {
    const viewerPath = getPlaylistViewerPathAtOffset(items, itemId, offset)
    if (viewerPath) navigate(viewerPath, { state: { returnTo } })
  }, [itemId, items, navigate, returnTo])

  const removeItem = useCallback(async (targetItemId: number) => {
    await api.playlists.removeItem(targetItemId)
    await load()
  }, [load])

  const reorderItems = useCallback(async (itemIds: number[]) => {
    setItems((currentItems) => {
      const itemById = new Map(currentItems.map((entry) => [entry.itemId, entry]))
      return itemIds.map((targetItemId, position) => {
        const entry = itemById.get(targetItemId)
        return entry ? { ...entry, position } : entry
      }).filter((entry): entry is PlaylistItem => Boolean(entry))
    })
    await api.playlists.reorderItems(itemIds)
    await load()
  }, [load])

  const clear = useCallback(async () => {
    await api.playlists.clear()
    await load()
    setVisible(false)
  }, [load])

  return {
    items,
    thumbnails,
    visible,
    available,
    canGoPrevious,
    canGoNext,
    setVisible: (next: boolean) => {
      setVisible(next)
      void api.settings.set('viewer.playlist.visible', next ? '1' : '0')
    },
    toggleVisible: () => {
      if (!available) return
      setVisible((value) => {
        const next = !value
        void api.settings.set('viewer.playlist.visible', next ? '1' : '0')
        return next
      })
    },
    goPrevious: () => openAtOffset(-1),
    goNext: () => openAtOffset(1),
    removeItem,
    reorderItems,
    clear,
  }
}

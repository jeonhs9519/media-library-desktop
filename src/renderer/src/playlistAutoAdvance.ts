import { api } from './api'
import { getViewerPath } from './components/Library/mediaLabels'
import type { PlaylistItem } from './types'

export function getPlaylistViewerPathAtOffset(
  playlistItems: PlaylistItem[],
  currentItemId: number,
  offset: -1 | 1,
) {
  const currentIndex = playlistItems.findIndex((entry: any) => entry.itemId === currentItemId)
  if (currentIndex < 0) return null

  const candidates = offset > 0
    ? playlistItems.slice(currentIndex + 1)
    : playlistItems.slice(0, currentIndex).reverse()

  for (const entry of candidates) {
    const viewerPath = getViewerPath(entry.item)
    if (viewerPath && entry.item.fileExists !== false) return viewerPath
  }

  return null
}

export async function getNextPlaylistViewerPath(currentItemId: number) {
  const playlistItems = await api.playlists.getItems()
  return getPlaylistViewerPathAtOffset(playlistItems, currentItemId, 1)
}

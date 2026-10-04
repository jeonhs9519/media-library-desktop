import { useCallback, useRef, useState } from 'react'
import { api } from '../../api'
import type { BookViewerViewMode } from './index'
import { normalizeScrollZoom } from '../../bookScrollModel'

export function normalizeBookViewMode(value: unknown): BookViewerViewMode {
  return value === 'scroll' || value === 'double-ltr' || value === 'double-rtl' ? value : 'single'
}

export function useBookViewerViewMode(itemId: number) {
  const [viewMode, updateViewMode] = useState<BookViewerViewMode>('single')
  const modeRef = useRef<BookViewerViewMode>('single')
  const [scrollZoom, updateScrollZoom] = useState(1)
  const hydratedItem = useRef<number | null>(null)
  const hydrateViewMode = useCallback(
    (saved: unknown, savedZoom?: unknown) => {
      modeRef.current = normalizeBookViewMode(saved)
      hydratedItem.current = itemId
      updateViewMode(modeRef.current)
      updateScrollZoom(normalizeScrollZoom(savedZoom))
    },
    [itemId]
  )
  const setViewMode = useCallback(
    (next: BookViewerViewMode | ((previous: BookViewerViewMode) => BookViewerViewMode)) => {
      if (hydratedItem.current !== itemId) return
      const mode = typeof next === 'function' ? next(modeRef.current) : next
      modeRef.current = mode
      updateViewMode(mode)
      void api.items.update(itemId, { bookViewMode: mode }).catch(console.error)
    },
    [itemId]
  )
  const setScrollZoom = useCallback(
    (value: number) => {
      if (hydratedItem.current !== itemId || modeRef.current !== 'scroll') return
      const zoom = normalizeScrollZoom(value)
      updateScrollZoom(zoom)
      void api.items
        .update(itemId, { bookScrollZoom: zoom, bookViewMode: modeRef.current })
        .catch(console.error)
    },
    [itemId]
  )
  return { viewMode, setViewMode, hydrateViewMode, scrollZoom, setScrollZoom }
}

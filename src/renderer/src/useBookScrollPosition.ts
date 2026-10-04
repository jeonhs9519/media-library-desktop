import { useCallback, useEffect, useRef } from 'react'
import { api } from './api'
import { normalizeScrollOffset, type BookScrollPosition } from './bookScrollModel'

export function useBookScrollPosition(itemId: number, count: number) {
  const latest = useRef<BookScrollPosition>({ page: 0, offset: 0 })
  const pending = useRef<{ id: number; fields: Record<string, number> } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const save = pending.current
    pending.current = null
    if (save) void api.items.update(save.id, save.fields).catch(console.error)
  }, [])
  useEffect(() => {
    window.addEventListener('beforeunload', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      flush()
    }
  }, [itemId, flush])
  const hydrateScrollPosition = useCallback((page: number, offset: unknown) => {
    latest.current = { page, offset: normalizeScrollOffset(offset) }
  }, [])
  const saveScrollPosition = useCallback(
    (page: number, offset: number) => {
      latest.current = { page, offset: normalizeScrollOffset(offset) }
      pending.current = {
        id: itemId,
        fields: {
          lastPageIndex: page,
          bookScrollOffset: latest.current.offset,
          progress: count > 0 ? (page + 1) / count : 0,
        },
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 180)
    },
    [itemId, count, flush]
  )
  return {
    hydrateScrollPosition,
    saveScrollPosition,
    flushScrollPosition: flush,
    getScrollOffset: (page: number) => (latest.current.page === page ? latest.current.offset : 0),
  }
}

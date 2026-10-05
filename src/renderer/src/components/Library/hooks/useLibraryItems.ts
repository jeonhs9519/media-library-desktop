import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../../api'
import type { Item } from '../../../types'
import {
  needsLibraryReload,
  patchLibraryItem,
  subscribeLibraryUpdates,
} from '../../../libraryUpdates'
import { preloadViewerPages } from '../../../routes/viewerPages'
import type { useLibrarySearchFilters } from './useLibrarySearchFilters'
import { useLibraryMetadataFill } from './useLibraryMetadataFill'

function runWhenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const callbackId = window.requestIdleCallback(task, { timeout: 3000 })
    return () => window.cancelIdleCallback(callbackId)
  }

  const timeoutId = window.setTimeout(task, 500)
  return () => window.clearTimeout(timeoutId)
}

type Options = {
  active: boolean
  searchFilters: ReturnType<typeof useLibrarySearchFilters>
  loadPlaylistItems: () => Promise<void>
}

export function useLibraryItems({ active, searchFilters, loadPlaylistItems }: Options) {
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const initialListReadyReportedRef = useRef(false)
  const [initialListReady, setInitialListReady] = useState(false)
  const perPage = 100
  const reloadOnReturn = useRef(false)
  const wasActive = useRef(active)
  const [metadataRefreshVersion, setMetadataRefreshVersion] = useState(0)

  const loadItems = useCallback(
    async (tagChange?: { removedId: number | null; id: number }) => {
      setLoading(true)
      try {
        const nextTagUsageCounts = await api.tags.getUsageCounts()
        const activeTagIds = searchFilters.reconcileTagUsageCounts(
          nextTagUsageCounts,
          tagChange?.removedId,
          tagChange?.id
        )
        const result = await api.items.getAll({
          search: searchFilters.search || undefined,
          contentType: searchFilters.contentType || undefined,
          language: searchFilters.language || undefined,
          watchedState:
            searchFilters.watchedState === 'all' ? undefined : searchFilters.watchedState,
          fileState: searchFilters.fileState === 'all' ? undefined : searchFilters.fileState,
          tagIds: !searchFilters.untaggedOnly && activeTagIds.length > 0 ? activeTagIds : undefined,
          untagged: searchFilters.untaggedOnly || undefined,
          sortBy: searchFilters.sortBy,
          sortDir: searchFilters.sortDir,
          page: searchFilters.page,
          perPage,
        })
        setItems(result.items)
        setTotal(result.total)
        if (!initialListReadyReportedRef.current) {
          initialListReadyReportedRef.current = true
          setInitialListReady(true)
        }
      } finally {
        setLoading(false)
      }
    },
    [
      searchFilters.search,
      searchFilters.contentType,
      searchFilters.language,
      searchFilters.watchedState,
      searchFilters.fileState,
      searchFilters.untaggedOnly,
      searchFilters.sortBy,
      searchFilters.sortDir,
      searchFilters.page,
      searchFilters.reconcileTagUsageCounts,
    ]
  )

  const latestList = useRef({
    items,
    active,
    loadItems,
    watchedState: searchFilters.watchedState,
    sortBy: searchFilters.sortBy,
  })
  latestList.current = {
    items,
    active,
    loadItems,
    watchedState: searchFilters.watchedState,
    sortBy: searchFilters.sortBy,
  }
  useEffect(
    () =>
      subscribeLibraryUpdates((update) => {
        const current = latestList.current
        const previous = current.items.find((item) => item.id === update.id)
        if (needsLibraryReload(update, previous, current.watchedState, current.sortBy)) {
          reloadOnReturn.current = true
          if (current.active) {
            reloadOnReturn.current = false
            void current.loadItems().catch(console.error)
          }
        }
        if (update.item)
          setItems((items) =>
            items.map((item) =>
              item.id === update.id ? patchLibraryItem(item, update.item!) : item
            )
          )
      }),
    []
  )

  useEffect(() => {
    const returned = active && !wasActive.current
    wasActive.current = active
    if (!returned) return
    if (reloadOnReturn.current) {
      reloadOnReturn.current = false
      void loadItems().catch(console.error)
    }
    void loadPlaylistItems().catch(console.error)
  }, [active, loadItems, loadPlaylistItems])

  const reloadNewItems = useCallback(async () => {
    setMetadataRefreshVersion((version) => version + 1)
    await loadItems()
  }, [loadItems])
  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (!initialListReady) return

    api.startup.markLibraryReady().catch((error: unknown) => {
      console.error('Failed to mark library ready:', error)
    })

    return runWhenIdle(() => {
      preloadViewerPages().catch((error: unknown) => {
        console.error('Failed to preload viewer pages:', error)
      })
    })
  }, [initialListReady])

  useLibraryMetadataFill({ total, loadItems, refreshVersion: metadataRefreshVersion })

  return { items, total, loading, perPage, loadItems, reloadNewItems }
}

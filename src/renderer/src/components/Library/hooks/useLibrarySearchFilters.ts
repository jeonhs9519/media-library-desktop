import { useCallback, useMemo, useState } from 'react'
import type { TagUsageCount, Translate } from '../types'

export type WatchedState = 'all' | 'unread' | 'inProgress' | 'completed'
export type FileState = 'all' | 'normal' | 'missing'

const SEARCH_STATE_KEY = 'library.searchState'

type SavedSearchState = {
  search?: string
  contentType?: string
  language?: string
  watchedState?: WatchedState
  fileState?: FileState
  selectedTagIds?: unknown
  untaggedOnly?: boolean
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
}

function readSavedSearch(): SavedSearchState {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function readSavedTagIds(savedSearch: SavedSearchState) {
  const value = savedSearch.selectedTagIds
  if (!Array.isArray(value)) return []
  return value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function useLibrarySearchFilters(tr: Translate) {
  const savedSearch = useMemo(() => readSavedSearch(), [])
  const [search, setSearch] = useState<string>(() => savedSearch.search ?? '')
  const [contentType, setContentType] = useState<string>(() => savedSearch.contentType ?? '')
  const [language, setLanguage] = useState<string>(() => savedSearch.language ?? '')
  const [watchedState, setWatchedState] = useState<WatchedState>(() => savedSearch.watchedState ?? 'all')
  const [fileState, setFileState] = useState<FileState>(() => savedSearch.fileState ?? 'all')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => readSavedTagIds(savedSearch))
  const [untaggedOnly, setUntaggedOnly] = useState<boolean>(() => savedSearch.untaggedOnly === true)
  const [tagUsageCounts, setTagUsageCounts] = useState<TagUsageCount[]>([])
  const [sortBy, setSortBy] = useState<string>(() => savedSearch.sortBy ?? 'createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => savedSearch.sortDir ?? 'desc')
  const [page, setPage] = useState<number>(() => savedSearch.page ?? 1)

  const persist = useCallback(() => {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
      search,
      contentType,
      language,
      watchedState,
      fileState,
      selectedTagIds,
      untaggedOnly,
      sortBy,
      sortDir,
      page,
    }))
  }, [search, contentType, language, watchedState, fileState, selectedTagIds, untaggedOnly, sortBy, sortDir, page])

  const resetSearch = useCallback(() => {
    setSearch('')
    setContentType('')
    setLanguage('')
    setWatchedState('all')
    setFileState('all')
    setSelectedTagIds([])
    setUntaggedOnly(false)
    setSortBy('createdAt')
    setSortDir('desc')
    setPage(1)
    sessionStorage.removeItem(SEARCH_STATE_KEY)
  }, [])

  const toggleTag = useCallback((tagId: number) => {
    setUntaggedOnly(false)
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId])
    setPage(1)
  }, [])

  const toggleUntagged = useCallback(() => {
    setUntaggedOnly((current) => !current)
    setSelectedTagIds([])
    setPage(1)
  }, [])

  const clearTags = useCallback(() => {
    setSelectedTagIds([])
    setUntaggedOnly(false)
    setPage(1)
  }, [])

  const handleFilterChange = useCallback((callback: () => void) => {
    callback()
    setPage(1)
  }, [])

  const reconcileTagUsageCounts = useCallback((nextTagUsageCounts: TagUsageCount[]) => {
    setTagUsageCounts(nextTagUsageCounts)
    const availableTagIds = new Set(nextTagUsageCounts.map((tag) => tag.id))
    const activeTagIds = selectedTagIds.filter((tagId) => availableTagIds.has(tagId))
    if (activeTagIds.length !== selectedTagIds.length) {
      setSelectedTagIds(activeTagIds)
    }
    return activeTagIds
  }, [selectedTagIds])

  const getTagSummary = useCallback(() => {
    if (untaggedOnly) return tr('filters.untagged')
    if (selectedTagIds.length === 0) return tr('filters.all')

    const selectedTags = tagUsageCounts
      .filter((tag) => selectedTagIds.includes(tag.id))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return selectedTags.map((tag) => tag.name).join(', ')
  }, [selectedTagIds, tagUsageCounts, tr, untaggedOnly])

  const filterSummary = useMemo(() => [
    `${tr('filters.summary.keyword')}: ${search.trim() || tr('filters.unspecified')}`,
    `${tr('filters.summary.type')}: ${contentType ? tr(`filters.type.${contentType}`) : tr('filters.all')}`,
    `${tr('filters.summary.language')}: ${language ? tr(`filters.language.${language}`) : tr('filters.all')}`,
    `${tr('filters.summary.progress')}: ${watchedState === 'all' ? tr('filters.all') : tr(`filters.reading.${watchedState}`)}`,
    `${tr('filters.summary.file')}: ${fileState === 'all' ? tr('filters.all') : tr(`filters.file.${fileState}`)}`,
    `${tr('filters.summary.sort')}: ${tr(`filters.sort.${sortBy}`)} ${sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}`,
    `${tr('filters.summary.tags')}: ${getTagSummary()}`,
  ].join(' / '), [search, contentType, language, watchedState, fileState, sortBy, sortDir, getTagSummary, tr])

  return useMemo(() => ({
    search,
    setSearch,
    contentType,
    setContentType,
    language,
    setLanguage,
    watchedState,
    setWatchedState,
    fileState,
    setFileState,
    selectedTagIds,
    untaggedOnly,
    tagUsageCounts,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    page,
    setPage,
    persist,
    resetSearch,
    toggleTag,
    toggleUntagged,
    clearTags,
    handleFilterChange,
    reconcileTagUsageCounts,
    filterSummary,
  }), [
    search,
    contentType,
    language,
    watchedState,
    fileState,
    selectedTagIds,
    untaggedOnly,
    tagUsageCounts,
    sortBy,
    sortDir,
    page,
    persist,
    resetSearch,
    toggleTag,
    toggleUntagged,
    clearTags,
    handleFilterChange,
    reconcileTagUsageCounts,
    filterSummary,
  ])
}

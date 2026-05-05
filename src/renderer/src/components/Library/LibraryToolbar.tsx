import React from 'react'
import type { TagUsageCount, Translate } from './types'
import { RefreshIcon, SearchIcon, SettingsGearIcon } from '../icons'

interface Props {
  searchRef: React.RefObject<HTMLButtonElement>
  search: string
  setSearch: (value: string) => void
  contentType: string
  setContentType: (value: string) => void
  language: string
  setLanguage: (value: string) => void
  watchedState: 'all' | 'unread' | 'inProgress' | 'completed'
  setWatchedState: (value: 'all' | 'unread' | 'inProgress' | 'completed') => void
  fileState: 'all' | 'normal' | 'missing'
  setFileState: (value: 'all' | 'normal' | 'missing') => void
  sortBy: string
  setSortBy: (value: string) => void
  sortDir: 'asc' | 'desc'
  setSortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>
  tagUsageCounts: TagUsageCount[]
  selectedTagIds: number[]
  untaggedOnly: boolean
  onToggleTag: (tagId: number) => void
  setPage: (value: number) => void
  onResetSearch: () => void
  onOpenSearchFilters: () => void
  onOpenFileUploadModal: () => void
  onReload: () => void
  onOpenSettings: () => void
  tr: Translate
}

export default function LibraryToolbar({
  searchRef,
  search,
  contentType,
  language,
  watchedState,
  fileState,
  sortBy,
  sortDir,
  selectedTagIds,
  untaggedOnly,
  onResetSearch,
  onOpenSearchFilters,
  onOpenFileUploadModal,
  onReload,
  onOpenSettings,
  tr,
}: Props) {
  const hasSelectedTags = untaggedOnly || selectedTagIds.length > 0
  const hasCustomSearch = search !== '' || contentType !== '' || language !== '' || watchedState !== 'all' || fileState !== 'all' || hasSelectedTags || sortBy !== 'createdAt' || sortDir !== 'desc'
  const searchShortcut = /\b(Mac|iPhone|iPad|iPod)\b/i.test(navigator.platform) ? 'Cmd + F' : 'Ctrl + F'

  return (
    <div className="library-toolbar">
      <div className="library-toolbar-controls">
        <button
          ref={searchRef}
          className="btn-primary library-search-button"
          aria-label={`${tr('filters.searchButton')} (${searchShortcut})`}
          onClick={onOpenSearchFilters}
        >
          <SearchIcon />
          <span>{tr('filters.searchButton')}</span>
          <span className="library-search-shortcut">({searchShortcut})</span>
        </button>
        <button
          className="btn-secondary"
          disabled={!hasCustomSearch}
          onClick={onResetSearch}
          style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}
        >
          {tr('filters.resetSearch')}
        </button>
      </div>

      <div className="library-toolbar-actions">
        <button className="btn-primary" onClick={onOpenFileUploadModal}>{tr('actions.addFile')}</button>
        <button className="btn-secondary library-icon-button" title={tr('app.reload')} aria-label={tr('app.reload')} onClick={onReload}>
          <RefreshIcon />
        </button>
        <button className="btn-secondary library-icon-button" title={tr('actions.settings')} aria-label={tr('actions.settings')} onClick={onOpenSettings}>
          <SettingsGearIcon />
        </button>
      </div>
    </div>
  )
}

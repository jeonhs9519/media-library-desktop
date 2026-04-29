import React from 'react'
import type { Translate } from './types'
import { RefreshIcon, SettingsGearIcon, SortAscendingIcon, SortDescendingIcon } from '../icons'

interface Props {
  searchRef: React.RefObject<HTMLInputElement>
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
  setPage: (value: number) => void
  onResetSearch: () => void
  onOpenFileUploadModal: () => void
  onOpenHdtUploadModal: () => void
  onReload: () => void
  onOpenSettings: () => void
  tr: Translate
}

export default function LibraryToolbar({
  searchRef,
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
  sortBy,
  setSortBy,
  sortDir,
  setSortDir,
  setPage,
  onResetSearch,
  onOpenFileUploadModal,
  onOpenHdtUploadModal,
  onReload,
  onOpenSettings,
  tr,
}: Props) {
  const hasCustomSearch = search !== '' || contentType !== '' || language !== '' || watchedState !== 'all' || fileState !== 'all' || sortBy !== 'createdAt' || sortDir !== 'desc'

  return (
    <div className="library-toolbar">
      <div className="library-toolbar-controls">
        <div className="library-search-box">
          <input
            ref={searchRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={tr('filters.searchPlaceholder')}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </div>

        <div className="library-filter-group">
          <select value={contentType} onChange={e => { setContentType(e.target.value); setPage(1) }}>
            <option value="">{tr('filters.allTypes')}</option>
            <option value="book">{tr('filters.type.book')}</option>
            <option value="comic">{tr('filters.type.comic')}</option>
            <option value="video">{tr('filters.type.video')}</option>
            <option value="other">{tr('filters.type.other')}</option>
          </select>

          <select value={language} onChange={e => { setLanguage(e.target.value); setPage(1) }}>
            <option value="">{tr('filters.allLanguages')}</option>
            <option value="ko">{tr('filters.language.ko')}</option>
            <option value="ja">{tr('filters.language.ja')}</option>
            <option value="en">{tr('filters.language.en')}</option>
            <option value="zh">{tr('filters.language.zh')}</option>
            <option value="other">{tr('filters.language.other')}</option>
          </select>

          <select value={watchedState} onChange={e => { setWatchedState(e.target.value as Props['watchedState']); setPage(1) }}>
            <option value="all">{tr('filters.reading.all')}</option>
            <option value="unread">{tr('filters.reading.unread')}</option>
            <option value="inProgress">{tr('filters.reading.inProgress')}</option>
            <option value="completed">{tr('filters.reading.completed')}</option>
          </select>

          <select value={fileState} onChange={e => { setFileState(e.target.value as Props['fileState']); setPage(1) }}>
            <option value="all">{tr('filters.file.all')}</option>
            <option value="normal">{tr('filters.file.normal')}</option>
            <option value="missing">{tr('filters.file.missing')}</option>
          </select>
        </div>

        <div className="library-filter-group">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="createdAt">{tr('filters.sort.createdAt')}</option>
            <option value="updatedAt">{tr('filters.sort.updatedAt')}</option>
            <option value="title">{tr('filters.sort.title')}</option>
            <option value="fileModifiedAt">{tr('filters.sort.fileModifiedAt')}</option>
          </select>

          <button
            className="btn-secondary library-icon-button"
            title={sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}
            aria-label={sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
          >
            {sortDir === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />}
          </button>

          {hasCustomSearch && (
            <button
              className="btn-secondary"
              onClick={onResetSearch}
              style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}
            >
              {tr('filters.resetSearch')}
            </button>
          )}
        </div>
      </div>

      <div className="library-toolbar-actions">
        <button className="btn-primary" onClick={onOpenFileUploadModal}>{tr('actions.addFile')}</button>
        <button className="btn-secondary" onClick={onOpenHdtUploadModal}>{tr('actions.importHdt')}</button>
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

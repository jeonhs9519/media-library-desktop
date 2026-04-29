import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Item } from '../types'
import { useI18n } from '../useI18n'
import { api } from '../api'
import LibraryGrid from '../components/Library/LibraryGrid'
import LibraryToolbar from '../components/Library/LibraryToolbar'
import DuplicateFileModal from '../components/Library/modals/DuplicateFileModal'
import FileDropModal from '../components/Library/modals/FileDropModal'
import HdtImportModal from '../components/Library/modals/HdtImportModal'
import ItemDetailModal from '../components/Library/modals/ItemDetailModal'
import SearchFiltersModal from '../components/Library/modals/SearchFiltersModal'
import SettingsModal from '../components/Library/modals/SettingsModal'
import { BulkRelinkConfirmModal, BulkRelinkConflictModal, BulkRelinkErrorModal } from '../components/Library/modals/BulkRelinkModals'
import { useFileImport } from '../components/Library/hooks/useFileImport'
import { useHdtImport } from '../components/Library/hooks/useHdtImport'
import { useLibrarySettings } from '../components/Library/hooks/useLibrarySettings'
import type { TagUsageCount } from '../components/Library/types'

type MetadataFillStatus = {
  running: boolean
  queued: number
  processed: number
  updated: number
  failed: number
}

const SEARCH_STATE_KEY = 'library.searchState'

function readSavedSearch() {
  try {
    const raw = sessionStorage.getItem(SEARCH_STATE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readSavedTagIds() {
  const value = readSavedSearch()?.selectedTagIds
  if (!Array.isArray(value)) return []
  return value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState<string>(() => readSavedSearch()?.search ?? '')
  const [contentType, setContentType] = useState<string>(() => readSavedSearch()?.contentType ?? '')
  const [language, setLanguage] = useState<string>(() => readSavedSearch()?.language ?? '')
  const [watchedState, setWatchedState] = useState<'all' | 'unread' | 'inProgress' | 'completed'>(() => readSavedSearch()?.watchedState ?? 'all')
  const [fileState, setFileState] = useState<'all' | 'normal' | 'missing'>(() => readSavedSearch()?.fileState ?? 'all')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => readSavedTagIds())
  const [untaggedOnly, setUntaggedOnly] = useState<boolean>(() => readSavedSearch()?.untaggedOnly === true)
  const [tagUsageCounts, setTagUsageCounts] = useState<TagUsageCount[]>([])
  const [sortBy, setSortBy] = useState<string>(() => readSavedSearch()?.sortBy ?? 'createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => readSavedSearch()?.sortDir ?? 'desc')
  const [page, setPage] = useState<number>(() => readSavedSearch()?.page ?? 1)
  const [thumbnails, setThumbnails] = useState<Record<number, string>>({})
  const loadedThumbnailIds = useRef<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const [libraryFocusRequest, setLibraryFocusRequest] = useState(0)
  const searchRef = useRef<HTMLButtonElement>(null)
  const metadataFillStartedRef = useRef(false)
  const metadataFillUpdatedRef = useRef(0)
  const perPage = 100
  const { tr, languageSetting, changeLanguageSetting } = useI18n()

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const nextTagUsageCounts = await api.tags.getUsageCounts() as TagUsageCount[]
      setTagUsageCounts(nextTagUsageCounts)
      const availableTagIds = new Set(nextTagUsageCounts.map((tag) => tag.id))
      const activeTagIds = selectedTagIds.filter((tagId) => availableTagIds.has(tagId))
      if (activeTagIds.length !== selectedTagIds.length) {
        setSelectedTagIds(activeTagIds)
      }
      const result = await api.items.getAll({
        search: search || undefined,
        contentType: contentType || undefined,
        language: language || undefined,
        watchedState: watchedState === 'all' ? undefined : watchedState,
        fileState: fileState === 'all' ? undefined : fileState,
        tagIds: !untaggedOnly && activeTagIds.length > 0 ? activeTagIds : undefined,
        untagged: untaggedOnly || undefined,
        sortBy,
        sortDir,
        page,
        perPage,
      })
      setItems(result.items)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [search, contentType, language, watchedState, fileState, selectedTagIds, untaggedOnly, sortBy, sortDir, page])

  const fileImport = useFileImport({ tr, loadItems })
  const hdtImport = useHdtImport({ tr, loadItems })
  const librarySettings = useLibrarySettings({ tr, changeLanguageSetting, loadItems })

  useEffect(() => {
    sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({
      search, contentType, language, watchedState, fileState, selectedTagIds, untaggedOnly, sortBy, sortDir, page,
    }))
  }, [search, contentType, language, watchedState, fileState, selectedTagIds, untaggedOnly, sortBy, sortDir, page])

  const handleResetSearch = () => {
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
  }

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    if (metadataFillStartedRef.current || total <= 0) return

    metadataFillStartedRef.current = true
    let canceled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const syncStatus = async (status: MetadataFillStatus) => {
      if (status.updated > metadataFillUpdatedRef.current) {
        metadataFillUpdatedRef.current = status.updated
        await loadItems()
      }

      if (!status.running && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const startBackgroundFill = async () => {
      try {
        const initialStatus = await api.items.fillMissingMetadata() as MetadataFillStatus
        if (canceled) return

        await syncStatus(initialStatus)

        if (initialStatus.running) {
          pollTimer = setInterval(async () => {
            try {
              const nextStatus = await api.items.getMetadataFillStatus() as MetadataFillStatus
              if (canceled) return
              await syncStatus(nextStatus)
            } catch (e) {
              console.error('Failed to read metadata fill status:', e)
            }
          }, 2000)
        }
      } catch (e) {
        console.error('Failed to start metadata fill:', e)
      }
    }

    startBackgroundFill()

    return () => {
      canceled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [total, loadItems])

  useEffect(() => {
    const loadThumbnails = async () => {
      for (const item of items) {
        if (!loadedThumbnailIds.current.has(item.id)) {
          loadedThumbnailIds.current.add(item.id)
          const thumb = await api.thumbnail.get(item.id)
          if (thumb) {
            setThumbnails(prev => ({ ...prev, [item.id]: `data:image/jpeg;base64,${thumb}` }))
          }
        }
      }
    }
    loadThumbnails()
  }, [items])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchFiltersOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!id) {
      setDetailItemId(null)
      return
    }
    const parsed = parseInt(id)
    setDetailItemId(Number.isNaN(parsed) ? null : parsed)
  }, [id])

  const handleOpenDetail = (itemId: number) => {
    setDetailItemId(itemId)
    navigate(`/items/${itemId}`)
  }

  const handleToggleTag = (tagId: number) => {
    setUntaggedOnly(false)
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId])
    setPage(1)
  }

  const handleToggleUntagged = () => {
    setUntaggedOnly((current) => !current)
    setSelectedTagIds([])
    setPage(1)
  }

  const handleClearTags = () => {
    setSelectedTagIds([])
    setUntaggedOnly(false)
    setPage(1)
  }

  const handleFilterChange = (callback: () => void) => {
    callback()
    setPage(1)
  }

  const getTagSummary = () => {
    if (untaggedOnly) return tr('filters.untagged')
    if (selectedTagIds.length === 0) return tr('filters.all')

    const selectedTags = tagUsageCounts
      .filter((tag) => selectedTagIds.includes(tag.id))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

    return selectedTags.map((tag) => tag.name).join(', ')
  }

  const filterSummary = [
    `${tr('filters.summary.keyword')}: ${search.trim() || tr('filters.unspecified')}`,
    `${tr('filters.summary.type')}: ${contentType ? tr(`filters.type.${contentType}`) : tr('filters.all')}`,
    `${tr('filters.summary.language')}: ${language ? tr(`filters.language.${language}`) : tr('filters.all')}`,
    `${tr('filters.summary.progress')}: ${watchedState === 'all' ? tr('filters.all') : tr(`filters.reading.${watchedState}`)}`,
    `${tr('filters.summary.file')}: ${fileState === 'all' ? tr('filters.all') : tr(`filters.file.${fileState}`)}`,
    `${tr('filters.summary.sort')}: ${tr(`filters.sort.${sortBy}`)} ${sortDir === 'asc' ? tr('filters.sort.asc') : tr('filters.sort.desc')}`,
    `${tr('filters.summary.tags')}: ${getTagSummary()}`,
  ].join(' / ')

  const handleCloseDetail = async () => {
    setDetailItemId(null)
    navigate('/')
    await loadItems()
    setLibraryFocusRequest((value) => value + 1)
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
      onDragOver={e => e.preventDefault()}
      onDrop={(event) => fileImport.handleRootDrop(event, fileImport.fileUploadModalOpen || hdtImport.isHdtModalOpen)}
    >
      <div
        style={{
          height: 32,
          flexShrink: 0,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0 12px',
          paddingRight: 150,
          WebkitAppRegion: 'drag' as any,
        } as any}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.2 }}>{tr('app.title')}</span>
      </div>

      <LibraryToolbar
        searchRef={searchRef}
        search={search}
        setSearch={(value) => handleFilterChange(() => setSearch(value))}
        contentType={contentType}
        setContentType={(value) => handleFilterChange(() => setContentType(value))}
        language={language}
        setLanguage={(value) => handleFilterChange(() => setLanguage(value))}
        watchedState={watchedState}
        setWatchedState={(value) => handleFilterChange(() => setWatchedState(value))}
        fileState={fileState}
        setFileState={(value) => handleFilterChange(() => setFileState(value))}
        sortBy={sortBy}
        setSortBy={(value) => handleFilterChange(() => setSortBy(value))}
        sortDir={sortDir}
        setSortDir={setSortDir}
        tagUsageCounts={tagUsageCounts}
        selectedTagIds={selectedTagIds}
        untaggedOnly={untaggedOnly}
        onToggleTag={handleToggleTag}
        setPage={setPage}
        onResetSearch={handleResetSearch}
        onOpenSearchFilters={() => setSearchFiltersOpen(true)}
        onOpenFileUploadModal={fileImport.openFileUploadModal}
        onOpenHdtUploadModal={hdtImport.openHdtUploadModal}
        onReload={() => api.app.reload()}
        onOpenSettings={librarySettings.openSettingsModal}
        tr={tr}
      />

      <LibraryGrid
        items={items}
        thumbnails={thumbnails}
        total={total}
        loading={loading}
        filterSummary={filterSummary}
        page={page}
        perPage={perPage}
        setPage={setPage}
        onOpenDetail={handleOpenDetail}
        focusRequest={libraryFocusRequest}
        tr={tr}
      />

      <DuplicateFileModal
        fileName={fileImport.duplicateModal?.fileName}
        onClose={() => fileImport.setDuplicateModal(null)}
        tr={tr}
      />

      <FileDropModal
        open={fileImport.fileUploadModalOpen}
        dragging={fileImport.fileUploadDragging}
        notice={fileImport.fileUploadNotice}
        title={tr('modal.fileUpload.title')}
        description={tr('modal.fileUpload.description')}
        supported={tr('modal.fileUpload.supported')}
        dropHere={tr('modal.fileUpload.dropHere')}
        dropActive={tr('modal.fileUpload.dropActive')}
        dropHint={tr('modal.fileUpload.dropHint')}
        onClose={fileImport.closeFileUploadModal}
        onBrowse={fileImport.handleBrowseFiles}
        onDragOver={fileImport.handleFileUploadDragOver}
        onDragLeave={fileImport.handleFileUploadDragLeave}
        onDrop={fileImport.handleFileUploadDrop}
        tr={tr}
      />

      <FileDropModal
        open={hdtImport.hdtUploadModalOpen}
        dragging={hdtImport.hdtUploadDragging}
        notice={hdtImport.hdtUploadNotice}
        title={tr('modal.hdtUpload.title')}
        description={tr('modal.hdtUpload.description')}
        supported={tr('modal.hdtUpload.supported')}
        dropHere={tr('modal.hdtUpload.dropHere')}
        dropActive={tr('modal.hdtUpload.dropActive')}
        dropHint={tr('modal.hdtUpload.dropHint')}
        onClose={hdtImport.closeHdtUploadModal}
        onBrowse={hdtImport.handleBrowseHdtFiles}
        onDragOver={hdtImport.handleHdtUploadDragOver}
        onDragLeave={hdtImport.handleHdtUploadDragLeave}
        onDrop={hdtImport.handleHdtUploadDrop}
        tr={tr}
      />

      <HdtImportModal
        open={hdtImport.hdtModalOpen}
        applying={hdtImport.hdtApplying}
        stats={hdtImport.hdtPreviewStats}
        selectedIds={hdtImport.hdtSelectedIds}
        groupedItems={hdtImport.groupedHdtPreviewItems}
        onClose={hdtImport.closeHdtImport}
        onApply={hdtImport.handleApplyHdt}
        onToggleItem={hdtImport.handleToggleHdtItem}
        onSelectGroup={hdtImport.handleSelectHdtGroup}
        onClearGroup={hdtImport.handleClearHdtGroup}
        getReasonLabel={hdtImport.getHdtReasonLabel}
        tr={tr}
      />

      <ItemDetailModal itemId={detailItemId} onClose={handleCloseDetail} />

      <SearchFiltersModal
        open={searchFiltersOpen}
        search={search}
        contentType={contentType}
        language={language}
        watchedState={watchedState}
        fileState={fileState}
        sortBy={sortBy}
        sortDir={sortDir}
        tagUsageCounts={tagUsageCounts}
        selectedTagIds={selectedTagIds}
        untaggedOnly={untaggedOnly}
        onClose={() => setSearchFiltersOpen(false)}
        onChangeSearch={(value) => handleFilterChange(() => setSearch(value))}
        onChangeContentType={(value) => handleFilterChange(() => setContentType(value))}
        onChangeLanguage={(value) => handleFilterChange(() => setLanguage(value))}
        onChangeWatchedState={(value) => handleFilterChange(() => setWatchedState(value))}
        onChangeFileState={(value) => handleFilterChange(() => setFileState(value))}
        onChangeSortBy={(value) => handleFilterChange(() => setSortBy(value))}
        onChangeSortDir={(value) => handleFilterChange(() => setSortDir(value))}
        onToggleTag={handleToggleTag}
        onToggleUntagged={handleToggleUntagged}
        onResetSearch={handleResetSearch}
        tr={tr}
      />

      <SettingsModal
        open={librarySettings.settingsModalOpen}
        languageSetting={languageSetting}
        fileModifiedPolicy={librarySettings.fileModifiedPolicy}
        bulkFromFolder={librarySettings.bulkFromFolder}
        bulkToFolder={librarySettings.bulkToFolder}
        bulkMatchCount={librarySettings.bulkMatchCount}
        bulkCounting={librarySettings.bulkCounting}
        bulkRelinking={librarySettings.bulkRelinking}
        bulkRelinkNotice={librarySettings.bulkRelinkNotice}
        onClose={librarySettings.closeSettingsModal}
        onChangeLanguageSetting={librarySettings.handleChangeLanguageSetting}
        onChangeFileModifiedPolicy={librarySettings.handleChangeFileModifiedPolicy}
        onPickBulkFromFolder={librarySettings.handlePickBulkFromFolder}
        onPickBulkToFolder={librarySettings.handlePickBulkToFolder}
        onOpenBulkRelinkConfirm={librarySettings.openBulkRelinkConfirm}
        tr={tr}
      />

      <BulkRelinkConfirmModal
        open={librarySettings.bulkRelinkConfirmOpen}
        relinking={librarySettings.bulkRelinking}
        fromFolder={librarySettings.bulkFromFolder}
        toFolder={librarySettings.bulkToFolder}
        matchCount={librarySettings.bulkMatchCount}
        onClose={librarySettings.closeBulkRelinkConfirm}
        onApply={librarySettings.handleApplyBulkRelink}
        tr={tr}
      />

      <BulkRelinkConflictModal
        conflict={librarySettings.bulkRelinkConflict}
        onClose={librarySettings.closeBulkRelinkConflict}
        tr={tr}
      />

      <BulkRelinkErrorModal
        open={librarySettings.bulkRelinkErrorOpen}
        errorMessage={librarySettings.bulkRelinkErrorMessage}
        failedTarget={librarySettings.bulkRelinkFailedTarget}
        onClose={librarySettings.closeBulkRelinkError}
        tr={tr}
      />
    </div>
  )
}




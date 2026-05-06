import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Item, PlaylistItem } from '../types'
import { useI18n } from '../useI18n'
import { api } from '../api'
import LibraryGrid from '../components/Library/LibraryGrid'
import LibraryToolbar from '../components/Library/LibraryToolbar'
import PlaylistPanel from '../components/Library/PlaylistPanel'
import DuplicateFileModal from '../components/Library/modals/DuplicateFileModal'
import FileDropModal from '../components/Library/modals/FileDropModal'
import HdtImportModal from '../components/Library/modals/HdtImportModal'
import ItemDetailModal from '../components/Library/modals/ItemDetailModal'
import LegacyDatabaseImportModal from '../components/Library/modals/LegacyDatabaseImportModal'
import SearchFiltersModal from '../components/Library/modals/SearchFiltersModal'
import SettingsModal from '../components/Library/modals/SettingsModal'
import { BulkRelinkConfirmModal, BulkRelinkConflictModal, BulkRelinkErrorModal } from '../components/Library/modals/BulkRelinkModals'
import { useFileImport } from '../components/Library/hooks/useFileImport'
import { useHdtImport } from '../components/Library/hooks/useHdtImport'
import { useLibrarySettings } from '../components/Library/hooks/useLibrarySettings'
import { useLibrarySearchFilters } from '../components/Library/hooks/useLibrarySearchFilters'
import { useLibraryThumbnails } from '../components/Library/hooks/useLibraryThumbnails'
import { useLibraryMetadataFill } from '../components/Library/hooks/useLibraryMetadataFill'
import { preloadViewerPages } from '../routes/viewerPages'

function runWhenIdle(task: () => void) {
  if ('requestIdleCallback' in window) {
    const callbackId = window.requestIdleCallback(task, { timeout: 3000 })
    return () => window.cancelIdleCallback(callbackId)
  }

  const timeoutId = window.setTimeout(task, 500)
  return () => window.clearTimeout(timeoutId)
}

export default function LibraryPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { tr, languageSetting, changeLanguageSetting } = useI18n()
  const searchFilters = useLibrarySearchFilters(tr)
  const [items, setItems] = useState<Item[]>([])
  const [total, setTotal] = useState(0)
  const thumbnails = useLibraryThumbnails(items)
  const [loading, setLoading] = useState(false)
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const [playlistItems, setPlaylistItems] = useState<PlaylistItem[]>([])
  const [playlistCollapsed, setPlaylistCollapsed] = useState(true)
  const [libraryFocusRequest, setLibraryFocusRequest] = useState(0)
  const [libraryToast, setLibraryToast] = useState<{ id: number; message: string; tone: 'success' | 'error' } | null>(null)
  const [libraryToastClosing, setLibraryToastClosing] = useState(false)
  const searchRef = useRef<HTMLButtonElement>(null)
  const initialListReadyReportedRef = useRef(false)
  const [initialListReady, setInitialListReady] = useState(false)
  const perPage = 100

  const playlistThumbnails = useLibraryThumbnails(playlistItems.map((entry) => entry.item))

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const nextTagUsageCounts = await api.tags.getUsageCounts()
      const activeTagIds = searchFilters.reconcileTagUsageCounts(nextTagUsageCounts)
      const result = await api.items.getAll({
        search: searchFilters.search || undefined,
        contentType: searchFilters.contentType || undefined,
        language: searchFilters.language || undefined,
        watchedState: searchFilters.watchedState === 'all' ? undefined : searchFilters.watchedState,
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
  }, [
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
  ])

  const loadPlaylistItems = useCallback(async () => {
    const result = await api.playlists.getItems()
    setPlaylistItems(result)
  }, [])

  const updatePlaylistCollapsed = useCallback((next: boolean | ((value: boolean) => boolean)) => {
    setPlaylistCollapsed((current) => {
      const resolved = typeof next === 'function'
        ? (next as (value: boolean) => boolean)(current)
        : next
      void api.settings.set('library.playlist.collapsed', resolved ? '1' : '0')
      return resolved
    })
  }, [])

  const fileImport = useFileImport({ tr, loadItems })
  const hdtImport = useHdtImport({ tr, loadItems })
  const librarySettings = useLibrarySettings({ tr, changeLanguageSetting, loadItems })

  useEffect(() => {
    searchFilters.persist()
  }, [searchFilters.persist])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  useEffect(() => {
    loadPlaylistItems()
  }, [loadPlaylistItems])

  useEffect(() => {
    if (!libraryToast) return
    const timeoutId = window.setTimeout(() => setLibraryToastClosing(true), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [libraryToast])

  useEffect(() => {
    if (!libraryToast || !libraryToastClosing) return
    const timeoutId = window.setTimeout(() => setLibraryToast(null), 160)
    return () => window.clearTimeout(timeoutId)
  }, [libraryToast, libraryToastClosing])

  useEffect(() => {
    api.settings.get('library.playlist.collapsed').then((value: string | undefined) => {
      if (value === '0' || value === '1') setPlaylistCollapsed(value === '1')
    })
  }, [])

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

  useLibraryMetadataFill({ total, loadItems })

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

  const handleCloseDetail = async () => {
    setDetailItemId(null)
    navigate('/')
    await loadItems()
    setLibraryFocusRequest((value) => value + 1)
  }

  const handleAddToPlaylist = async (item: Item) => {
    if (item.contentType === 'other') return
    await api.playlists.addItem(item.id)
    await loadPlaylistItems()
    updatePlaylistCollapsed(false)
  }

  const showLibraryToast = useCallback((message: string, tone: 'success' | 'error') => {
    setLibraryToastClosing(false)
    setLibraryToast((current) => ({ id: (current?.id ?? 0) + 1, message, tone }))
  }, [])

  const getMoveErrorMessage = useCallback((reason?: string) => {
    if (reason === 'duplicate-file') return tr('library.context.moveDuplicate')
    if (reason === 'current-profile') return tr('library.context.moveCurrent')
    if (reason === 'missing-profile') return tr('library.context.moveMissingProfile')
    return tr('library.context.moveFailed')
  }, [tr])

  const handleMoveToProfile = useCallback(async (item: Item, targetProfileId: number, targetProfileName: string) => {
    try {
      const result = await api.items.moveToProfile(item.id, targetProfileId)
      if (!result?.ok) {
        showLibraryToast(result?.message || getMoveErrorMessage(result?.reason), 'error')
        return false
      }

      await Promise.all([loadItems(), loadPlaylistItems()])
      showLibraryToast(tr('library.context.moveDone', { profile: targetProfileName }), 'success')
      return true
    } catch (error: any) {
      showLibraryToast(String(error?.message || error), 'error')
      return false
    }
  }, [getMoveErrorMessage, loadItems, loadPlaylistItems, showLibraryToast, tr])

  const handleCopyToProfile = useCallback(async (item: Item, targetProfileId: number, targetProfileName: string) => {
    try {
      const result = await api.items.copyToProfile(item.id, targetProfileId)
      if (!result?.ok) {
        showLibraryToast(result?.message || getMoveErrorMessage(result?.reason), 'error')
        return false
      }

      showLibraryToast(tr('library.context.copyDone', { profile: targetProfileName }), 'success')
      return true
    } catch (error: any) {
      showLibraryToast(String(error?.message || error), 'error')
      return false
    }
  }, [getMoveErrorMessage, showLibraryToast, tr])

  const handleDropToPlaylist = async (itemId: number, position?: number) => {
    const item = items.find((candidate) => candidate.id === itemId)
    if (item?.contentType === 'other') return
    await api.playlists.addItem(itemId, position)
    await loadPlaylistItems()
    updatePlaylistCollapsed(false)
  }

  const handleRemoveFromPlaylist = async (itemId: number) => {
    await api.playlists.removeItem(itemId)
    await loadPlaylistItems()
  }

  const handleClearPlaylist = async () => {
    await api.playlists.clear()
    await loadPlaylistItems()
  }

  const handleReorderPlaylistItems = async (itemIds: number[]) => {
    setPlaylistItems((currentItems) => {
      const itemById = new Map(currentItems.map((entry) => [entry.itemId, entry]))
      return itemIds.map((itemId, position) => {
        const entry = itemById.get(itemId)
        return entry ? { ...entry, position } : entry
      }).filter((entry): entry is PlaylistItem => Boolean(entry))
    })
    await api.playlists.reorderItems(itemIds)
    await loadPlaylistItems()
  }

  const playlistPanel = (
    <PlaylistPanel
      items={playlistItems}
      thumbnails={playlistThumbnails}
      collapsed={playlistCollapsed}
      position={librarySettings.playlistPosition}
      onToggleCollapsed={() => updatePlaylistCollapsed((value) => !value)}
      onDropItem={handleDropToPlaylist}
      onRemoveItem={handleRemoveFromPlaylist}
      onClear={handleClearPlaylist}
      onReorderItems={handleReorderPlaylistItems}
      viewerReturnTo="/"
      tr={tr}
    />
  )

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
        search={searchFilters.search}
        setSearch={(value) => searchFilters.handleFilterChange(() => searchFilters.setSearch(value))}
        contentType={searchFilters.contentType}
        setContentType={(value) => searchFilters.handleFilterChange(() => searchFilters.setContentType(value))}
        language={searchFilters.language}
        setLanguage={(value) => searchFilters.handleFilterChange(() => searchFilters.setLanguage(value))}
        watchedState={searchFilters.watchedState}
        setWatchedState={(value) => searchFilters.handleFilterChange(() => searchFilters.setWatchedState(value))}
        fileState={searchFilters.fileState}
        setFileState={(value) => searchFilters.handleFilterChange(() => searchFilters.setFileState(value))}
        sortBy={searchFilters.sortBy}
        setSortBy={(value) => searchFilters.handleFilterChange(() => searchFilters.setSortBy(value))}
        sortDir={searchFilters.sortDir}
        setSortDir={searchFilters.setSortDir}
        tagUsageCounts={searchFilters.tagUsageCounts}
        selectedTagIds={searchFilters.selectedTagIds}
        untaggedOnly={searchFilters.untaggedOnly}
        onToggleTag={searchFilters.toggleTag}
        setPage={searchFilters.setPage}
        onResetSearch={searchFilters.resetSearch}
        onOpenSearchFilters={() => setSearchFiltersOpen(true)}
        onOpenFileUploadModal={fileImport.openFileUploadModal}
        onReload={() => api.app.reload()}
        onOpenSettings={librarySettings.openSettingsModal}
        tr={tr}
      />

      <div className="library-main-area">
        <LibraryGrid
          items={items}
          thumbnails={thumbnails}
          total={total}
          loading={loading}
          filterSummary={searchFilters.filterSummary}
          page={searchFilters.page}
          perPage={perPage}
          setPage={searchFilters.setPage}
          onOpenDetail={handleOpenDetail}
          onAddToPlaylist={handleAddToPlaylist}
          onMoveToProfile={handleMoveToProfile}
          onCopyToProfile={handleCopyToProfile}
          playlistPanel={playlistPanel}
          playlistPosition={librarySettings.playlistPosition}
          focusRequest={libraryFocusRequest}
          tr={tr}
        />
      </div>

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

      {libraryToast ? (
        <div className={`library-center-toast is-${libraryToast.tone}${libraryToastClosing ? ' is-closing' : ''}`} role="status" aria-live="polite">
          {libraryToast.message}
        </div>
      ) : null}

      <ItemDetailModal
        itemId={detailItemId}
        onClose={handleCloseDetail}
        onAddToPlaylist={handleAddToPlaylist}
        onMoveToProfile={handleMoveToProfile}
        onCopyToProfile={handleCopyToProfile}
      />

      <SearchFiltersModal
        open={searchFiltersOpen}
        search={searchFilters.search}
        contentType={searchFilters.contentType}
        language={searchFilters.language}
        watchedState={searchFilters.watchedState}
        fileState={searchFilters.fileState}
        sortBy={searchFilters.sortBy}
        sortDir={searchFilters.sortDir}
        tagUsageCounts={searchFilters.tagUsageCounts}
        selectedTagIds={searchFilters.selectedTagIds}
        untaggedOnly={searchFilters.untaggedOnly}
        onClose={() => setSearchFiltersOpen(false)}
        onChangeSearch={(value) => searchFilters.handleFilterChange(() => searchFilters.setSearch(value))}
        onChangeContentType={(value) => searchFilters.handleFilterChange(() => searchFilters.setContentType(value))}
        onChangeLanguage={(value) => searchFilters.handleFilterChange(() => searchFilters.setLanguage(value))}
        onChangeWatchedState={(value) => searchFilters.handleFilterChange(() => searchFilters.setWatchedState(value))}
        onChangeFileState={(value) => searchFilters.handleFilterChange(() => searchFilters.setFileState(value))}
        onChangeSortBy={(value) => searchFilters.handleFilterChange(() => searchFilters.setSortBy(value))}
        onChangeSortDir={(value) => searchFilters.handleFilterChange(() => searchFilters.setSortDir(value))}
        onToggleTag={searchFilters.toggleTag}
        onToggleUntagged={searchFilters.toggleUntagged}
        onClearTags={searchFilters.clearTags}
        onResetSearch={searchFilters.resetSearch}
        tr={tr}
      />

      <SettingsModal
        open={librarySettings.settingsModalOpen}
        languageSetting={languageSetting}
        fileModifiedPolicy={librarySettings.fileModifiedPolicy}
        playlistPosition={librarySettings.playlistPosition}
        bulkFromFolder={librarySettings.bulkFromFolder}
        bulkToFolder={librarySettings.bulkToFolder}
        bulkMatchCount={librarySettings.bulkMatchCount}
        bulkCounting={librarySettings.bulkCounting}
        bulkRelinking={librarySettings.bulkRelinking}
        bulkRelinkNotice={librarySettings.bulkRelinkNotice}
        legacyDbPath={librarySettings.legacyDbPath}
        legacyDbNotice={librarySettings.legacyDbNotice}
        legacyDbPreviewing={librarySettings.legacyDbPreviewing}
        hdtFilePaths={hdtImport.hdtSelectedFilePaths}
        hdtNotice={hdtImport.hdtUploadNotice}
        hdtPreviewing={hdtImport.hdtPreviewing}
        profileStatus={librarySettings.profileStatus}
        profileNameDraft={librarySettings.profileNameDraft}
        profileNotice={librarySettings.profileNotice}
        profileToastClosing={librarySettings.profileToastClosing}
        profileNameErrorActive={librarySettings.profileNameErrorActive}
        profileNameFocusSignal={librarySettings.profileNameFocusSignal}
        profileBusy={librarySettings.profileBusy}
        onClose={librarySettings.closeSettingsModal}
        onChangeProfileNameDraft={librarySettings.setProfileNameDraft}
        onRenameProfile={librarySettings.handleRenameProfile}
        onOpenProfileSelection={librarySettings.handleOpenProfileSelection}
        onChangeLanguageSetting={librarySettings.handleChangeLanguageSetting}
        onChangeFileModifiedPolicy={librarySettings.handleChangeFileModifiedPolicy}
        onChangePlaylistPosition={librarySettings.handleChangePlaylistPosition}
        onPickBulkFromFolder={librarySettings.handlePickBulkFromFolder}
        onPickBulkToFolder={librarySettings.handlePickBulkToFolder}
        onOpenBulkRelinkConfirm={librarySettings.openBulkRelinkConfirm}
        onSelectLegacyDbFile={librarySettings.handleSelectLegacyDbFile}
        onPreviewLegacyDbImport={librarySettings.handlePreviewLegacyDbImport}
        onSelectHdtFiles={hdtImport.handleSelectHdtFiles}
        onPreviewHdtImport={hdtImport.handlePreviewSelectedHdtFiles}
        tr={tr}
      />

      <LegacyDatabaseImportModal
        open={librarySettings.legacyDbPreviewOpen}
        preview={librarySettings.legacyDbPreview}
        importing={librarySettings.legacyDbImporting}
        onClose={librarySettings.closeLegacyDbPreview}
        onApply={librarySettings.handleApplyLegacyDbImport}
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




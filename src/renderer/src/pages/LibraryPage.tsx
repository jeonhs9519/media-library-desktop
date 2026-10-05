import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useMatch } from 'react-router-dom'
import { Item } from '../types'
import { useI18n } from '../useI18n'
import { api } from '../api'
import LibraryGrid from '../components/Library/LibraryGrid'
import LibraryToolbar from '../components/Library/LibraryToolbar'
import PlaylistPanel from '../components/Library/PlaylistPanel'
import PlaylistManager from '../components/Library/PlaylistManager'
import { useLibraryPlaylists } from '../components/Library/hooks/useLibraryPlaylists'
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
import Toast, { useToast } from '../components/Toast'
import { useLibraryItems } from '../components/Library/hooks/useLibraryItems'
import { useLibraryProfileTransfer } from '../components/Library/hooks/useLibraryProfileTransfer'
import { getViewerPath } from '../components/Library/mediaLabels'

export default function LibraryPage({ active = true }: { active?: boolean }) {
  const navigate = useNavigate()
  const id = useMatch('/items/:id')?.params.id
  const { tr, languageSetting, changeLanguageSetting } = useI18n()
  const searchFilters = useLibrarySearchFilters(tr)
  const [searchFiltersOpen, setSearchFiltersOpen] = useState(false)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const [detailReturnTarget, setDetailReturnTarget] = useState<'library' | 'playlist'>('library')
  const playlists = useLibraryPlaylists()
  const loadPlaylistItems = playlists.reload
  const { items, total, loading, perPage, loadItems, reloadNewItems } = useLibraryItems({ active, searchFilters, loadPlaylistItems })
  const thumbnails = useLibraryThumbnails(items)
  const { toast: libraryToast, showToast: showLibraryToast, hideToast: hideLibraryToast } = useToast()
  const playlistItems = playlists.items
  const selectedPlaylistId = playlists.state?.selectedId
  const [playlistCollapsed, setPlaylistCollapsed] = useState(true)
  const [playlistFocusRequest, setPlaylistFocusRequest] = useState(0)
  const [playlistFocusItemId, setPlaylistFocusItemId] = useState<number | null>(null)
  const [libraryFocusRequest, setLibraryFocusRequest] = useState(0)
  const searchRef = useRef<HTMLButtonElement>(null)

  const playlistThumbnails = useLibraryThumbnails(playlistItems.map((entry) => entry.item))

  const updatePlaylistCollapsed = useCallback((next: boolean | ((value: boolean) => boolean)) => {
    setPlaylistCollapsed((current) => {
      const resolved = typeof next === 'function'
        ? (next as (value: boolean) => boolean)(current)
        : next
      void api.settings.set('library.playlist.collapsed', resolved ? '1' : '0')
      return resolved
    })
  }, [])

  const fileImport = useFileImport({ tr, loadItems: reloadNewItems })
  const hdtImport = useHdtImport({ tr, loadItems: reloadNewItems })
  const reloadLibraryData = useCallback(async () => {
    await Promise.all([loadItems(), loadPlaylistItems()])
  }, [loadItems, loadPlaylistItems])
  const reloadNewLibraryData = useCallback(async () => {
    await Promise.all([reloadNewItems(), loadPlaylistItems()])
  }, [reloadNewItems, loadPlaylistItems])
  const { handleMoveToProfile, handleCopyToProfile } = useLibraryProfileTransfer({ tr, reloadLibraryData, showLibraryToast })
  const librarySettings = useLibrarySettings({ tr, changeLanguageSetting, loadItems: reloadLibraryData, onItemsAdded: reloadNewLibraryData })

  useEffect(() => {
    searchFilters.persist()
  }, [searchFilters.persist])

  useEffect(() => {
    api.settings.get('library.playlist.collapsed').then((value: string | undefined) => {
      if (value === '0' || value === '1') setPlaylistCollapsed(value === '1')
    })
  }, [])

  useEffect(() => {
    if (!active) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchFiltersOpen(true)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active])

  useEffect(() => {
    if (!id) {
      setDetailItemId(null)
      return
    }
    const parsed = parseInt(id)
    setDetailItemId(Number.isNaN(parsed) ? null : parsed)
  }, [id])

  const handleOpenDetail = (itemId: number) => {
    setDetailReturnTarget('library')
    setDetailItemId(itemId)
    navigate(`/items/${itemId}`)
  }

  const handleOpenDetailFromPlaylist = (itemId: number) => {
    setDetailReturnTarget('playlist')
    setDetailItemId(itemId)
    navigate(`/items/${itemId}`)
  }

  const handleCloseDetail = async () => {
    const returnTarget = detailReturnTarget
    setDetailItemId(null)
    navigate('/')
    await Promise.all([loadItems(), loadPlaylistItems()])
    if (returnTarget === 'playlist') {
      setPlaylistFocusRequest((value) => value + 1)
    } else {
      setLibraryFocusRequest((value) => value + 1)
    }
  }

  const handleAddToPlaylist = async (item: Item, playlistId = selectedPlaylistId): Promise<boolean> => {
    if (!getViewerPath(item) || playlistId === undefined) return false
    try {
      const result = await api.playlists.addItem(item.id, undefined, playlistId)
      if (!result.ok) { showLibraryToast(tr('playlist.error.failed'), 'error'); return false }
      await loadPlaylistItems()
      if (playlistId !== selectedPlaylistId) {
        showLibraryToast(tr('playlist.added', { name: playlists.state?.lists.find(list => list.id === playlistId)?.name ?? '' }), 'success')
      }
      return true
    } catch {
      showLibraryToast(tr('playlist.error.failed'), 'error')
      return false
    }
  }

  const handleAddToPlaylistFromLibrary = async (item: Item, playlistId = selectedPlaylistId) => {
    if (!await handleAddToPlaylist(item, playlistId) || playlistCollapsed) return
    setPlaylistFocusItemId(playlistId === selectedPlaylistId ? item.id : null)
    setPlaylistFocusRequest((value) => value + 1)
  }

  const handleDropToPlaylist = async (itemId: number, position?: number) => {
    const item = items.find((candidate) => candidate.id === itemId)
    if (!item || !getViewerPath(item) || selectedPlaylistId === undefined || playlists.busy) return
    await api.playlists.addItem(itemId, position, selectedPlaylistId)
    await loadPlaylistItems()
    if (playlistCollapsed) return
    setPlaylistFocusItemId(itemId)
    setPlaylistFocusRequest((value) => value + 1)
  }

  const handleRemoveFromPlaylist = async (itemId: number) => {
    if (selectedPlaylistId === undefined) return
    await api.playlists.removeItem(itemId, selectedPlaylistId)
    await loadPlaylistItems()
  }

  const handleClearPlaylist = async () => {
    if (selectedPlaylistId === undefined) return
    await api.playlists.clear(selectedPlaylistId)
    await loadPlaylistItems()
  }

  const handleReorderPlaylistItems = async (itemIds: number[]) => {
    if (selectedPlaylistId === undefined) return
    await api.playlists.reorderItems(itemIds, selectedPlaylistId)
    await loadPlaylistItems()
  }

  const playlistPanel = (
    <PlaylistPanel
      playlistId={selectedPlaylistId}
      header={<PlaylistManager state={playlists.state} busy={playlists.busy} reload={loadPlaylistItems} tr={tr} />}
      items={playlistItems}
      thumbnails={playlistThumbnails}
      collapsed={playlistCollapsed}
      position={librarySettings.playlistPosition}
      onToggleCollapsed={() => updatePlaylistCollapsed((value) => !value)}
      onDropItem={handleDropToPlaylist}
      onRemoveItem={handleRemoveFromPlaylist}
      onClear={handleClearPlaylist}
      onReorderItems={handleReorderPlaylistItems}
      onOpenDetail={handleOpenDetailFromPlaylist}
      viewerReturnTo="/"
      focusRequest={playlistFocusRequest}
      focusItemId={playlistFocusItemId}
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
          onAddToPlaylist={handleAddToPlaylistFromLibrary}
          playlists={playlists.state?.lists ?? []}
          selectedPlaylistId={selectedPlaylistId}
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

      <Toast toast={libraryToast} onClose={hideLibraryToast} className={`library-center-toast is-${libraryToast?.tone}`} />

      <ItemDetailModal
        itemId={active ? detailItemId : null}
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
        tagUsageCounts={searchFilters.tagUsageCounts}
        onTagRenamed={(removedId, id) => loadItems({ removedId, id })}
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

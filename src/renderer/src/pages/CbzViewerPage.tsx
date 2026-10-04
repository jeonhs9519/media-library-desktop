import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useI18n } from '../useI18n'
import { api } from '../api'
import BookViewerOverlay, { useBookViewerViewMode } from '../components/BookViewerOverlay/index'
import { useBookViewerOverlayUx } from '../components/BookViewerOverlay/useBookViewerOverlayUx.ts'
import { useBookViewerKeyboard } from '../components/BookViewerOverlay/useBookViewerKeyboard.ts'
import Toast, { useToast } from '../components/Toast'
import { getNextPlaylistViewerPath } from '../playlistAutoAdvance'
import BookScrollView, { type BookScrollHandle } from '../components/BookScrollView'
import { useBookScrollPosition } from '../useBookScrollPosition'
import { useViewerPlaylist } from '../useViewerPlaylist'
import { useCbzPages } from '../useCbzPages'

export default function CbzViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const itemId = parseInt(id!)
  const scrollViewRef = useRef<BookScrollHandle>(null)
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || `/items/${itemId}`

  const [item, setItem] = useState<any>(null)
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const { tr } = useI18n()
  const thumbnailToast = useToast()
  const viewerPlaylist = useViewerPlaylist(itemId, navigate, returnTo)
  const {
    viewMode,
    setViewMode,
    hydrateViewMode,
    scrollZoom,
    setScrollZoom,
  } = useBookViewerViewMode(itemId)
  const pageStep = viewMode.startsWith('double') ? 2 : 1
  const [scrollVisibleCount, setScrollVisibleCount] = useState(2)
  const { images, errors, pageSizes } = useCbzPages(sessionId, currentPage, pages.length, viewMode === 'scroll' ? Math.max(2, scrollVisibleCount) : pageStep)
  const { hydrateScrollPosition, saveScrollPosition, getScrollOffset, flushScrollPosition } = useBookScrollPosition(itemId, pages.length)

  const {
    containerRef,
    isTopOverlayVisible,
    isFullscreen,
    isContextMenuOpen,
    contextMenu,
    toggleFullscreen,
    showTopOverlay,
    hideTopOverlayWithDelay,
    handleContextMenu,
    closeContextMenu,
  } = useBookViewerOverlayUx()

  const getFullPath = useCallback((itemData: any) => {
    return itemData.filePath + '/' + itemData.fileName +
      (itemData.fileExtension ? '.' + itemData.fileExtension : '')
  }, [])

  useEffect(() => {
    let cancelled = false
    let openedSession: string | null = null
    setLoading(true)
    setLoadError(false)
    setItem(null)
    setPages([])
    setSessionId(null)
    const load = async () => {
      const itemData = await api.items.getById(itemId)
      if (cancelled) return
      if (!itemData) throw new Error('Item not found')
      hydrateViewMode(itemData.bookViewMode, itemData.bookScrollZoom)
      if (cancelled) return
      const fullPath = getFullPath(itemData)
      const opened = await api.cbz.open(fullPath)
      openedSession = opened.sessionId
      if (cancelled) {
        await api.cbz.close(openedSession)
        return
      }
      if (opened.pages.length === 0) throw new Error('No image pages in ZIP')
      setItem(itemData)
      setPages(opened.pages)
      setSessionId(openedSession)
      if (itemData.totalContent !== opened.pages.length) {
        void api.items.update(itemId, { totalContent: opened.pages.length }).catch(console.error)
      }
      const savedPage = Number.isInteger(itemData.lastPageIndex) ? itemData.lastPageIndex : 0
      const startPage = Math.max(0, Math.min(opened.pages.length - 1, savedPage))
      hydrateScrollPosition(startPage, itemData.bookScrollOffset)
      setCurrentPage(startPage)
      setLoading(false)
    }
    load().catch(error => {
      console.error('Failed to open ZIP', error)
      if (openedSession) void api.cbz.close(openedSession).catch(console.error)
      if (!cancelled) { setLoadError(true); setLoading(false) }
    })
    return () => {
      cancelled = true
      if (openedSession) void api.cbz.close(openedSession).catch(console.error)
    }
  }, [itemId, getFullPath, hydrateViewMode, hydrateScrollPosition])

  useEffect(() => {
    if (pages.length === 0 || item?.id !== itemId || loading || viewMode === 'scroll') return
    const progress = (currentPage + 1) / pages.length
    api.items.update(itemId, { lastPageIndex: currentPage, bookScrollOffset: getScrollOffset(currentPage), progress }).catch(console.error)
  }, [currentPage, pages.length, itemId, item, loading, viewMode])

  const goToNextPageByStep = useCallback((step: number) => {
    if (pages.length > 0 && currentPage + step >= pages.length) {
      getNextPlaylistViewerPath(itemId)
        .then((nextPath) => {
          if (nextPath) navigate(nextPath, { state: { returnTo } })
        })
        .catch(console.error)
      return
    }

    setCurrentPage((p) => Math.min(pages.length - 1, p + step))
  }, [currentPage, itemId, navigate, pages.length, returnTo])

  useEffect(() => { if (viewMode !== 'scroll') flushScrollPosition() }, [viewMode, flushScrollPosition])

  useBookViewerKeyboard({
    viewMode,
    isContextMenuOpen,
    onViewModeChange: setViewMode,
    onPrevPage: (step) => setCurrentPage((p) => Math.max(0, p - step)),
    onNextPage: goToNextPageByStep,
    onGoHome: () => { scrollViewRef.current?.goToPage(0); setCurrentPage(0) },
    onToggleFullscreen: toggleFullscreen,
    onExitViewer: () => navigate(returnTo),
    onPlaylistPrevious: viewerPlaylist.goPrevious,
    onPlaylistNext: viewerPlaylist.goNext,
    onTogglePlaylist: viewerPlaylist.toggleVisible,
    onScrollUp: () => scrollViewRef.current?.scrollByHalfPage('up'),
    onScrollDown: () => scrollViewRef.current?.scrollByHalfPage('down'),
    onZoomIn: () => setScrollZoom(scrollZoom + 0.25),
    onZoomOut: () => setScrollZoom(scrollZoom - 0.25),
    onZoomReset: () => setScrollZoom(1),
  })

  const handleSetThumbnail = async () => {
    await api.thumbnail.setFromPage(itemId, currentPage)
    thumbnailToast.showToast(tr('viewer.thumbnailUpdated'))
  }

  const handleShowInFolder = async () => {
    if (!item) return
    await api.file.showInFolder(getFullPath(item))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.cbz.loading')}</div>
  if (loadError) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>
    <p role="alert">{tr('viewer.cbz.loadError')}</p>
    <button onClick={() => navigate(returnTo)}>{tr('common.back')}</button>
  </div>

  const rightPageDisplay = Math.min(pages.length, currentPage + 2)
  const pageLabel = !viewMode.startsWith('double') || currentPage + 1 >= pages.length
    ? `${currentPage + 1} / ${pages.length}`
    : `${currentPage + 1}-${rightPageDisplay} / ${pages.length}`

  const goToPrevPage = () => {
    setCurrentPage(p => Math.max(0, p - pageStep))
  }

  const goToNextPage = () => {
    goToNextPageByStep(pageStep)
  }

  const renderContent = () => {
    if (viewMode === 'scroll') return <BookScrollView ref={scrollViewRef} key={itemId} count={pages.length} page={currentPage}
      zoom={scrollZoom} initialOffset={getScrollOffset(currentPage)} pageSizes={pageSizes}
      onPageChange={setCurrentPage} onPositionChange={saveScrollPosition}
      onVisibleRangeChange={(_, count) => setScrollVisibleCount(count)} renderPage={(index, width) =>
      images[index] ? <img src={images[index]} alt={`Page ${index + 1}`} style={{ width, height: 'auto', display: 'block', margin: 0 }} />
        : <div role={errors[index] ? 'alert' : undefined}>{tr(errors[index] ? 'viewer.cbz.pageError' : 'common.loading')}</div>
    } />
    if (viewMode === 'single') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
          {images[currentPage]
            ? <img src={images[currentPage]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt={`Page ${currentPage + 1}`} />
            : <div role={errors[currentPage] ? 'alert' : undefined} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{tr(errors[currentPage] ? 'viewer.cbz.pageError' : 'common.loading')}</div>
          }
        </div>
      )
    }

    const leftIdx = viewMode === 'double-ltr' ? currentPage : currentPage + 1
    const rightIdx = viewMode === 'double-ltr' ? currentPage + 1 : currentPage

    return (
      <div style={{ display: 'flex', justifyContent: 'center', height: '100%', gap: 2 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {images[leftIdx]
            ? <img src={images[leftIdx]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt={`Page ${leftIdx + 1}`} />
            : leftIdx < pages.length ? <div role={errors[leftIdx] ? 'alert' : undefined} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{tr(errors[leftIdx] ? 'viewer.cbz.pageError' : 'common.loading')}</div> : null
          }
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          {images[rightIdx]
            ? <img src={images[rightIdx]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt={`Page ${rightIdx + 1}`} />
            : rightIdx < pages.length ? <div role={errors[rightIdx] ? 'alert' : undefined} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{tr(errors[rightIdx] ? 'viewer.cbz.pageError' : 'common.loading')}</div> : null
          }
        </div>
      </div>
    )
  }

  return (
    <BookViewerOverlay
      containerRef={containerRef}
      isTopOverlayVisible={isTopOverlayVisible}
      onMouseEnter={showTopOverlay}
      onMouseMove={showTopOverlay}
      onMouseLeave={hideTopOverlayWithDelay}
      onContextMenu={handleContextMenu}
      onBack={() => navigate(returnTo)}
      itemTitle={item?.title}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      scrollZoom={scrollZoom}
      onScrollZoomChange={setScrollZoom}
      pageLabel={pageLabel}
      onPrevPage={goToPrevPage}
      onNextPage={goToNextPage}
      onScrollUp={() => scrollViewRef.current?.scrollByHalfPage('up')}
      onScrollDown={() => scrollViewRef.current?.scrollByHalfPage('down')}
      onSetThumbnail={handleSetThumbnail}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      onShowInFolder={handleShowInFolder}
      onExitViewer={() => navigate(returnTo)}
      currentItemId={itemId}
      playlistItems={viewerPlaylist.items}
      playlistThumbnails={viewerPlaylist.thumbnails}
      playlistVisible={viewerPlaylist.visible}
      playlistAvailable={viewerPlaylist.available}
      playlistCanGoPrevious={viewerPlaylist.canGoPrevious}
      playlistCanGoNext={viewerPlaylist.canGoNext}
      onTogglePlaylist={viewerPlaylist.toggleVisible}
      onPlaylistPrevious={viewerPlaylist.goPrevious}
      onPlaylistNext={viewerPlaylist.goNext}
      onRemovePlaylistItem={viewerPlaylist.removeItem}
      onReorderPlaylistItems={viewerPlaylist.reorderItems}
      onClearPlaylist={viewerPlaylist.clear}
      viewerReturnTo={returnTo}
      contextMenu={contextMenu}
      onCloseContextMenu={closeContextMenu}
      contextMenuId="cbz-context-menu"
    >
      <Toast toast={thumbnailToast.toast} onClose={thumbnailToast.hideToast} />
      <div style={{ height: '100%', overflow: 'hidden', padding: 8 }}>
        {renderContent()}
      </div>
    </BookViewerOverlay>
  )
}

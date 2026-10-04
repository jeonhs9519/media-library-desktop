import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { useI18n } from '../useI18n'
import { api } from '../api'
import BookViewerOverlay, { useBookViewerViewMode } from '../components/BookViewerOverlay/index'
import { useBookViewerOverlayUx } from '../components/BookViewerOverlay/useBookViewerOverlayUx.ts'
import { useBookViewerKeyboard } from '../components/BookViewerOverlay/useBookViewerKeyboard.ts'
import Toast, { useToast } from '../components/Toast'
import BookScrollView, { type BookScrollHandle } from '../components/BookScrollView'
import PdfScrollPage from '../components/PdfScrollPage'
import { useBookScrollPosition } from '../useBookScrollPosition'
import { useViewerPlaylist } from '../useViewerPlaylist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

function clampPage(page: number, max: number): number {
  if (max <= 0) return 1
  return Math.min(Math.max(page, 1), max)
}

export default function PdfViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const itemId = parseInt(id!)
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || `/items/${itemId}`

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const renderVersions = useRef(new WeakMap<HTMLCanvasElement, number>())
  const [item, setItem] = useState<any>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollViewRef = useRef<BookScrollHandle>(null)
  const leftCanvasRef = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const leftRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const rightRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const { tr } = useI18n()
  const thumbnailToast = useToast()
  const viewerPlaylist = useViewerPlaylist(itemId, navigate, returnTo)
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
  const {
    viewMode,
    setViewMode,
    hydrateViewMode,
    scrollZoom,
    setScrollZoom,
  } = useBookViewerViewMode(itemId)

  const { hydrateScrollPosition, saveScrollPosition, getScrollOffset, flushScrollPosition } = useBookScrollPosition(itemId, pageCount)

  const getFullPath = useCallback((itemData: any) => {
    return itemData.filePath + '/' + itemData.fileName +
      (itemData.fileExtension ? '.' + itemData.fileExtension : '')
  }, [])

  useEffect(() => {
    let cancelled = false
    let task: pdfjsLib.PDFDocumentLoadingTask | undefined
    let opened: pdfjsLib.PDFDocumentProxy | undefined
    setLoading(true)
    setLoadError(false)
    setPdfDoc(null)
    setPageCount(0)
    setItem(null)
    const load = async () => {
      const itemData = await api.items.getById(itemId)
      if (cancelled) return
      if (!itemData) throw new Error('Item not found')
      hydrateViewMode(itemData.bookViewMode, itemData.bookScrollZoom)
      const base64 = await api.pdf.readFile(getFullPath(itemData))
      if (cancelled) return
      const data = atob(base64)
      const bytes = Uint8Array.from(data, character => character.charCodeAt(0))
      task = pdfjsLib.getDocument({ data: bytes })
      opened = await task.promise
      if (cancelled) { await opened.destroy(); return }
      setItem(itemData)
      setPdfDoc(opened)
      setPageCount(opened.numPages)
      if (itemData.totalContent !== opened.numPages) {
        void api.items.update(itemId, { totalContent: opened.numPages }).catch(console.error)
      }
      const saved = Number.isInteger(itemData.lastPageIndex) ? itemData.lastPageIndex + 1 : 1
      const startPage = clampPage(saved, opened.numPages)
      hydrateScrollPosition(startPage - 1, itemData.bookScrollOffset)
      setCurrentPage(startPage)
      setLoading(false)
    }
    void load().catch(error => {
      if (!cancelled) { console.error(error); setLoadError(true); setLoading(false) }
    })
    return () => {
      cancelled = true
      leftRenderTaskRef.current?.cancel()
      rightRenderTaskRef.current?.cancel()
      void (opened ? opened.destroy() : task?.destroy())?.catch(console.error)
    }
  }, [itemId, getFullPath, hydrateViewMode, hydrateScrollPosition])

  const renderPageToCanvas = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement | null,
    maxWidth: number,
    maxHeight: number,
    taskRef: React.MutableRefObject<pdfjsLib.RenderTask | null>
  ) => {
    if (!pdfDoc || !canvas) return

    const version = (renderVersions.current.get(canvas) || 0) + 1
    renderVersions.current.set(canvas, version)
    if (taskRef.current) {
      taskRef.current.cancel()
      taskRef.current = null
    }

    if (pageNum < 1 || pageNum > pageCount || maxWidth <= 0 || maxHeight <= 0) {
      canvas.width = 0
      canvas.height = 0
      canvas.style.width = '0px'
      canvas.style.height = '0px'
      return
    }

    const page = await pdfDoc.getPage(pageNum)
    if (!canvas.isConnected || renderVersions.current.get(canvas) !== version) return
    const baseViewport = page.getViewport({ scale: 1 })
    const fitScale = Math.max(0.1, Math.min(maxWidth / baseViewport.width, maxHeight / baseViewport.height))
    const viewport = page.getViewport({ scale: fitScale })
    const dpr = window.devicePixelRatio || 1

    // Keep drawing buffer and display size in sync to preserve original page ratio.
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`

    const ctx = canvas.getContext('2d')!
    const renderTransform: [number, number, number, number, number, number] | undefined =
      dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0]
    const renderTask = page.render({ canvas, canvasContext: ctx, viewport, transform: renderTransform })
    taskRef.current = renderTask

    try {
      await renderTask.promise
    } catch (error: any) {
      if (error?.name !== 'RenderingCancelledException') {
        throw error
      }
    } finally {
      if (taskRef.current === renderTask) taskRef.current = null
    }

  }, [pdfDoc, pageCount])

  const renderCurrentPages = useCallback(async () => {
    if (viewMode === 'scroll') {
      leftRenderTaskRef.current?.cancel()
      rightRenderTaskRef.current?.cancel()
      return
    }
    if (!pdfDoc || viewportSize.width <= 0 || viewportSize.height <= 0) return

    if (viewMode === 'single') {
      await renderPageToCanvas(currentPage, leftCanvasRef.current, viewportSize.width, viewportSize.height, leftRenderTaskRef)
      await renderPageToCanvas(-1, rightCanvasRef.current, 0, 0, rightRenderTaskRef)
      return
    }

    const gap = 8
    const slotWidth = Math.max(1, (viewportSize.width - gap) / 2)
    const leftPage = viewMode === 'double-ltr' ? currentPage : currentPage + 1
    const rightPage = viewMode === 'double-ltr' ? currentPage + 1 : currentPage

    await Promise.all([
      renderPageToCanvas(leftPage, leftCanvasRef.current, slotWidth, viewportSize.height, leftRenderTaskRef),
      renderPageToCanvas(rightPage, rightCanvasRef.current, slotWidth, viewportSize.height, rightRenderTaskRef),
    ])
  }, [pdfDoc, viewportSize, viewMode, currentPage, renderPageToCanvas])

  useEffect(() => {
    if (loading) return

    const el = viewportRef.current
    if (!el) return

    const updateSize = () => {
      setViewportSize({ width: el.clientWidth, height: el.clientHeight })
    }

    updateSize()

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSize())
      : null
    if (observer) observer.observe(el)

    window.addEventListener('resize', updateSize)

    return () => {
      if (observer) observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [loading])

  useEffect(() => {
    return () => {
      if (leftRenderTaskRef.current) leftRenderTaskRef.current.cancel()
      if (rightRenderTaskRef.current) rightRenderTaskRef.current.cancel()
    }
  }, [])

  useEffect(() => {
    renderCurrentPages().catch(console.error)
  }, [renderCurrentPages])

  useEffect(() => {
    if (pageCount <= 0 || loading || item?.id !== itemId || viewMode === 'scroll') return
    const progress = currentPage / pageCount
    api.items.update(itemId, {
      lastPageIndex: currentPage - 1,
      bookScrollOffset: getScrollOffset(currentPage - 1),
      progress,
    }).catch(console.error)
  }, [currentPage, pageCount, itemId, item, loading, viewMode])

  const goToNextPageByStep = useCallback((step: number) => {
    if (pageCount > 0 && currentPage + step > pageCount) {
      viewerPlaylist.advance().catch(console.error)
      return
    }

    setCurrentPage((p) => clampPage(p + step, pageCount))
  }, [currentPage, pageCount, viewerPlaylist.advance])

  useEffect(() => { if (viewMode !== 'scroll') flushScrollPosition() }, [viewMode, flushScrollPosition])

  useBookViewerKeyboard({
    viewMode,
    isContextMenuOpen,
    onViewModeChange: setViewMode,
    onPrevPage: (step) => setCurrentPage((p) => clampPage(p - step, pageCount)),
    onNextPage: goToNextPageByStep,
    onGoHome: () => { scrollViewRef.current?.goToPage(0); setCurrentPage(1) },
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
    const activeCanvas = viewMode === 'scroll' ? viewportRef.current?.querySelector<HTMLCanvasElement>(`[data-book-page="${currentPage - 1}"] canvas`) : viewMode === 'double-rtl' ? rightCanvasRef.current : leftCanvasRef.current
    if (!activeCanvas || activeCanvas.width === 0 || activeCanvas.height === 0) return
    const base64 = activeCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    await api.thumbnail.setFromImageData(itemId, base64)
    thumbnailToast.showToast(tr('viewer.thumbnailUpdated'))
  }

  const handleShowInFolder = async () => {
    if (!item) return
    await api.file.showInFolder(getFullPath(item))
  }

  const pageStep = viewMode.startsWith('double') ? 2 : 1
  const rightPageDisplay = Math.min(pageCount, currentPage + 1)
  const pageLabel = !viewMode.startsWith('double') || currentPage === rightPageDisplay
    ? `${currentPage} / ${pageCount}`
    : `${currentPage}-${rightPageDisplay} / ${pageCount}`

  const goToPrevPage = () => {
    setCurrentPage(p => clampPage(p - pageStep, pageCount))
  }

  const goToNextPage = () => {
    goToNextPageByStep(pageStep)
  }

  const renderContent = () => {
    if (viewMode === 'scroll' && pdfDoc) return <BookScrollView ref={scrollViewRef} key={itemId} count={pageCount} page={currentPage - 1}
      zoom={scrollZoom} initialOffset={getScrollOffset(currentPage - 1)} onPositionChange={saveScrollPosition}
      onPageChange={index => setCurrentPage(index + 1)} renderPage={(index, width, reportSize) => <PdfScrollPage document={pdfDoc} page={index} width={width} reportSize={reportSize} />} />
    if (viewMode === 'single') {
      return (
        <canvas
          ref={leftCanvasRef}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        />
      )
    }

    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 0 }}>
          <canvas
            ref={leftCanvasRef}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center', minWidth: 0 }}>
          <canvas
            ref={rightCanvasRef}
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'block',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </div>
    )
  }

  if (loadError) return <div style={{ padding: 24 }}><p role="alert">{tr('viewer.pdf.pageError')}</p><button onClick={() => navigate(returnTo)}>{tr('common.back')}</button></div>
  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.pdf.loading')}</div>

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
      playlistId={viewerPlaylist.playlistId}
      contextMenu={contextMenu}
      onCloseContextMenu={closeContextMenu}
      contextMenuId="pdf-context-menu"
    >
      <Toast toast={thumbnailToast.toast} onClose={thumbnailToast.hideToast} />
      <div ref={viewportRef} style={{ height: '100%', overflow: 'hidden', padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {renderContent()}
      </div>
    </BookViewerOverlay>
  )
}

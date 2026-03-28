import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { useI18n } from '../useI18n'
import { api } from '../api'
import BookViewerOverlay, { useBookViewerViewMode } from '../components/BookViewerOverlay/index'
import { useBookViewerOverlayUx } from '../components/BookViewerOverlay/useBookViewerOverlayUx.ts'
import { useBookViewerKeyboard } from '../components/BookViewerOverlay/useBookViewerKeyboard.ts'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

const PDF_VIEW_MODE_SETTING_KEY = 'pdf.viewMode'

function clampPage(page: number, max: number): number {
  if (max <= 0) return 1
  return Math.min(Math.max(page, 1), max)
}

export default function PdfViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = parseInt(id!)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<any>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewportRef = useRef<HTMLDivElement>(null)
  const leftCanvasRef = useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = useRef<HTMLCanvasElement>(null)
  const leftRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const rightRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const { tr } = useI18n()
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
  } = useBookViewerViewMode(PDF_VIEW_MODE_SETTING_KEY)

  const getFullPath = useCallback((itemData: any) => {
    return itemData.filePath + '/' + itemData.fileName +
      (itemData.fileExtension ? '.' + itemData.fileExtension : '')
  }, [])

  useEffect(() => {
    const load = async () => {
      const itemData = await api.items.getById(itemId)
      setItem(itemData)

      await hydrateViewMode()

      const fullPath = getFullPath(itemData)

      const base64 = await api.pdf.readFile(fullPath)
      const data = atob(base64)
      const bytes = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i)

      const doc = await pdfjsLib.getDocument({ data: bytes }).promise
      setPdfDoc(doc)
      setPageCount(doc.numPages)

      // Save totalContent if not already saved
      if (!itemData.totalContent) {
        await api.items.update(itemId, { totalContent: doc.numPages })
      }

      const startPage = itemData.lastPageIndex ? itemData.lastPageIndex + 1 : 1
      setCurrentPage(Math.min(startPage, doc.numPages))
      setLoading(false)
    }
    load().catch(console.error)
  }, [itemId, getFullPath, hydrateViewMode])

  const renderPageToCanvas = useCallback(async (
    pageNum: number,
    canvas: HTMLCanvasElement | null,
    maxWidth: number,
    maxHeight: number,
    taskRef: React.MutableRefObject<pdfjsLib.RenderTask | null>
  ) => {
    if (!pdfDoc || !canvas) return

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
    if (pageCount <= 0) return
    const progress = currentPage / pageCount
    api.items.update(itemId, {
      lastPageIndex: currentPage - 1,
      progress,
    }).catch(console.error)
  }, [currentPage, pageCount, itemId])

  useBookViewerKeyboard({
    viewMode,
    isContextMenuOpen,
    onViewModeChange: setViewMode,
    onPrevPage: (step) => setCurrentPage((p) => clampPage(p - step, pageCount)),
    onNextPage: (step) => setCurrentPage((p) => clampPage(p + step, pageCount)),
    onGoHome: () => setCurrentPage(1),
    onToggleFullscreen: toggleFullscreen,
    onExitViewer: () => navigate(`/items/${itemId}`),
  })

  const handleSetThumbnail = async () => {
    const activeCanvas = viewMode === 'double-rtl' ? rightCanvasRef.current : leftCanvasRef.current
    if (!activeCanvas || activeCanvas.width === 0 || activeCanvas.height === 0) return
    const base64 = activeCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]
    await api.thumbnail.setFromImageData(itemId, base64)
    alert(tr('viewer.thumbnailUpdated'))
  }

  const handleShowInFolder = async () => {
    if (!item) return
    await api.file.showInFolder(getFullPath(item))
  }

  const pageStep = viewMode === 'single' ? 1 : 2
  const rightPageDisplay = Math.min(pageCount, currentPage + 1)
  const pageLabel = viewMode === 'single' || currentPage === rightPageDisplay
    ? `${currentPage} / ${pageCount}`
    : `${currentPage}-${rightPageDisplay} / ${pageCount}`

  const goToPrevPage = () => {
    setCurrentPage(p => clampPage(p - pageStep, pageCount))
  }

  const goToNextPage = () => {
    setCurrentPage(p => clampPage(p + pageStep, pageCount))
  }

  const renderContent = () => {
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

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.pdf.loading')}</div>

  return (
    <BookViewerOverlay
      containerRef={containerRef}
      isTopOverlayVisible={isTopOverlayVisible}
      onMouseEnter={showTopOverlay}
      onMouseMove={showTopOverlay}
      onMouseLeave={hideTopOverlayWithDelay}
      onContextMenu={handleContextMenu}
      onBack={() => navigate(`/items/${itemId}`)}
      itemTitle={item?.title}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      pageLabel={pageLabel}
      onPrevPage={goToPrevPage}
      onNextPage={goToNextPage}
      onSetThumbnail={handleSetThumbnail}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      onShowInFolder={handleShowInFolder}
      onExitViewer={() => navigate(`/items/${itemId}`)}
      contextMenu={contextMenu}
      onCloseContextMenu={closeContextMenu}
      contextMenuId="pdf-context-menu"
    >
      <div ref={viewportRef} style={{ height: '100%', overflow: 'hidden', padding: 8, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {renderContent()}
      </div>
    </BookViewerOverlay>
  )
}

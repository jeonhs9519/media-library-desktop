import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { useI18n } from '../useI18n'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

type PdfViewMode = 'single' | 'double-ltr' | 'double-rtl'

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
  const [viewMode, setViewMode] = useState<PdfViewMode>('single')
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<any>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const leftCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const rightCanvasRef = React.useRef<HTMLCanvasElement>(null)
  const leftRenderTaskRef = React.useRef<pdfjsLib.RenderTask | null>(null)
  const rightRenderTaskRef = React.useRef<pdfjsLib.RenderTask | null>(null)
  const { tr } = useI18n()

  useEffect(() => {
    const load = async () => {
      const itemData = await window.api.items.getById(itemId)
      setItem(itemData)

      const fullPath = itemData.filePath + '/' + itemData.fileName +
        (itemData.fileExtension ? '.' + itemData.fileExtension : '')

      const base64 = await window.api.pdf.readFile(fullPath)
      const data = atob(base64)
      const bytes = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i)

      const doc = await pdfjsLib.getDocument({ data: bytes }).promise
      setPdfDoc(doc)
      setPageCount(doc.numPages)

      const startPage = itemData.lastPageIndex ? itemData.lastPageIndex + 1 : 1
      setCurrentPage(Math.min(startPage, doc.numPages))
      setLoading(false)
    }
    load().catch(console.error)
  }, [itemId])

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
    const shownPage = viewMode === 'single'
      ? currentPage
      : Math.min(pageCount, currentPage + 1)

    const progress = shownPage / pageCount
    window.api.items.update(itemId, {
      lastPageIndex: shownPage - 1,
      progress,
    }).catch(console.error)
  }, [currentPage, pageCount, itemId, viewMode])

  useEffect(() => {
    const step = viewMode === 'single' ? 1 : 2
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => clampPage(p - step, pageCount))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => clampPage(p + step, pageCount))
      } else if (e.key === 'Home') {
        setCurrentPage(1)
      } else if (e.key === 'Escape') {
        navigate(`/items/${itemId}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [viewMode, pageCount, itemId, navigate])

  const handleSetThumbnail = async () => {
    if (!leftCanvasRef.current || leftCanvasRef.current.width === 0 || leftCanvasRef.current.height === 0) return
    const base64 = leftCanvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1]
    await window.api.thumbnail.setFromImageData(itemId, base64)
    alert(tr('viewer.thumbnailUpdated'))
  }

  const step = viewMode === 'single' ? 1 : 2
  const rightPage = Math.min(pageCount, currentPage + 1)
  const pageLabel = viewMode === 'single' || currentPage === rightPage
    ? `${currentPage} / ${pageCount}`
    : `${currentPage}-${rightPage} / ${pageCount}`

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.pdf.loading')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
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

      <div style={{
        background: 'var(--bg-secondary)', padding: '8px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={() => navigate(`/items/${itemId}`)}>{tr('common.back')}</button>
        <span style={{ fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item?.title}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          {(['single', 'double-ltr', 'double-rtl'] as PdfViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode(mode)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {mode === 'single'
                ? `□ ${tr('viewer.cbz.mode.single')}`
                : mode === 'double-ltr'
                  ? `□□→ ${tr('viewer.cbz.mode.doubleLtr')}`
                  : `←□□ ${tr('viewer.cbz.mode.doubleRtl')}`}
            </button>
          ))}

          <button className="btn-secondary" onClick={() => setCurrentPage(p => clampPage(p - step, pageCount))} disabled={currentPage <= 1}>◀</button>
          <input
            type="number"
            value={currentPage}
            min={1}
            max={pageCount}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1 && v <= pageCount) setCurrentPage(clampPage(v, pageCount))
            }}
            style={{ width: 60, textAlign: 'center' }}
          />
          <span>{pageLabel}</span>
          <button className="btn-secondary" onClick={() => setCurrentPage(p => clampPage(p + step, pageCount))} disabled={currentPage >= pageCount}>▶</button>
          <button className="btn-secondary" onClick={handleSetThumbnail}>📷 {tr('viewer.setThumbnail')}</button>
        </div>
      </div>

      <div ref={viewportRef} style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
        {viewMode === 'single' ? (
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
        ) : (
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
        )}
      </div>
    </div>
  )
}

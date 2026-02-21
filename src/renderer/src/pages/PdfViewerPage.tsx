import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { useI18n } from '../useI18n'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export default function PdfViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = parseInt(id!)

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<any>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
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

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return

    const page = await pdfDoc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.5 })
    const canvas = canvasRef.current
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')!
    await page.render({ canvas, canvasContext: ctx, viewport }).promise

    const progress = pageNum / pageCount
    await window.api.items.update(itemId, {
      lastPageIndex: pageNum - 1,
      progress,
    })
  }, [pdfDoc, pageCount, itemId])

  useEffect(() => {
    if (pdfDoc) renderPage(currentPage)
  }, [pdfDoc, currentPage, renderPage])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => Math.max(1, p - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage(p => Math.min(pageCount, p + 1))
      } else if (e.key === 'Home') {
        setCurrentPage(1)
      } else if (e.key === 'Escape') {
        navigate(`/items/${itemId}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pageCount, itemId, navigate])

  const handleSetThumbnail = async () => {
    if (!canvasRef.current) return
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1]
    await window.api.thumbnail.setFromImageData(itemId, base64)
    alert(tr('viewer.thumbnailUpdated'))
  }

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
          <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>◀</button>
          <input
            type="number"
            value={currentPage}
            min={1}
            max={pageCount}
            onChange={e => {
              const v = parseInt(e.target.value)
              if (!isNaN(v) && v >= 1 && v <= pageCount) setCurrentPage(v)
            }}
            style={{ width: 60, textAlign: 'center' }}
          />
          <span>/ {pageCount}</span>
          <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))} disabled={currentPage >= pageCount}>▶</button>
          <button className="btn-secondary" onClick={handleSetThumbnail}>📷 {tr('viewer.setThumbnail')}</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16 }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
      </div>
    </div>
  )
}

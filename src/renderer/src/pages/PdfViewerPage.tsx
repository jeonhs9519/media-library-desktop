import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'

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
    await page.render({ canvasContext: ctx, viewport }).promise

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
    alert('Thumbnail updated!')
  }

  if (loading) return <div style={{ padding: 24, color: '#e0e0e0' }}>Loading PDF...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1a1a2e' }}>
      <div style={{
        background: '#16213e', padding: '8px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid #2a2a4a', flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={() => navigate(`/items/${itemId}`)}>← Back</button>
        <span style={{ fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item?.title}
        </span>
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
        <button className="btn-secondary" onClick={handleSetThumbnail}>📷 Set Thumbnail</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16 }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
      </div>
    </div>
  )
}

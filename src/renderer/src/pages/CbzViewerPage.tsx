import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

type ViewMode = 'scroll' | 'single' | 'double-ltr' | 'double-rtl'

export default function CbzViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = parseInt(id!)

  const [item, setItem] = useState<any>(null)
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [images, setImages] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  const getFullPath = useCallback((itemData: any) => {
    return itemData.filePath + '/' + itemData.fileName +
      (itemData.fileExtension ? '.' + itemData.fileExtension : '')
  }, [])

  useEffect(() => {
    const load = async () => {
      const itemData = await window.api.items.getById(itemId)
      setItem(itemData)

      const fullPath = getFullPath(itemData)
      const pageList = await window.api.cbz.getPages(fullPath)
      setPages(pageList)

      const startPage = itemData.lastPageIndex || 0
      setCurrentPage(startPage)
      setLoading(false)
    }
    load().catch(console.error)
  }, [itemId, getFullPath])

  useEffect(() => {
    if (!item || pages.length === 0) return

    const fullPath = getFullPath(item)

    const loadPage = async (idx: number) => {
      if (idx < 0 || idx >= pages.length || images[idx]) return
      try {
        const base64 = await window.api.cbz.getPage(fullPath, idx)
        setImages(prev => ({ ...prev, [idx]: `data:image/jpeg;base64,${base64}` }))
      } catch (e) {
        console.error('Failed to load page', idx, e)
      }
    }

    loadPage(currentPage)
    loadPage(currentPage + 1)
    loadPage(currentPage - 1)
  }, [currentPage, pages, item, getFullPath])

  useEffect(() => {
    if (pages.length === 0) return
    const progress = (currentPage + 1) / pages.length
    window.api.items.update(itemId, { lastPageIndex: currentPage, progress }).catch(console.error)
  }, [currentPage, pages.length, itemId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (viewMode === 'scroll') return
      const step = viewMode.startsWith('double') ? 2 : 1

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage(p => Math.max(0, p - step))
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setCurrentPage(p => Math.min(pages.length - 1, p + step))
      } else if (e.key === 'Home') {
        setCurrentPage(0)
      } else if (e.key === 'Escape') {
        navigate(`/items/${itemId}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [viewMode, pages.length, itemId, navigate])

  const handleSetThumbnail = async () => {
    await window.api.thumbnail.setFromPage(itemId, currentPage)
    alert('Thumbnail updated!')
  }

  if (loading) return <div style={{ padding: 24, color: '#e0e0e0' }}>Loading CBZ...</div>

  const renderContent = () => {
    if (viewMode === 'scroll') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {pages.map((_, idx) => {
            const src = images[idx]
            if (!src) {
              return (
                <div key={idx} style={{ width: '100%', minHeight: 400, background: '#0f3460', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span>Loading page {idx + 1}...</span>
                </div>
              )
            }
            return <img key={idx} src={src} style={{ maxWidth: '100%', display: 'block' }} alt={`Page ${idx + 1}`} />
          })}
        </div>
      )
    }

    if (viewMode === 'single') {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', height: '100%' }}>
          {images[currentPage]
            ? <img src={images[currentPage]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt={`Page ${currentPage + 1}`} />
            : <div style={{ display: 'flex', alignItems: 'center', color: '#a0a0b0' }}>Loading...</div>
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
            : <div style={{ display: 'flex', alignItems: 'center', color: '#a0a0b0' }}>Loading...</div>
          }
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
          {images[rightIdx]
            ? <img src={images[rightIdx]} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt={`Page ${rightIdx + 1}`} />
            : null
          }
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111' }}>
      <div style={{
        background: '#16213e', padding: '8px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid #2a2a4a', flexShrink: 0,
      }}>
        <button className="btn-secondary" onClick={() => navigate(`/items/${itemId}`)}>← Back</button>
        <span style={{ fontWeight: 'bold' }}>{item?.title}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['scroll', 'single', 'double-ltr', 'double-rtl'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode(mode)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {mode === 'scroll' ? '↕ Scroll' : mode === 'single' ? '□ Single' : mode === 'double-ltr' ? '□□→' : '←□□'}
            </button>
          ))}

          {viewMode !== 'scroll' && (
            <>
              <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.max(0, p - (viewMode.startsWith('double') ? 2 : 1)))}>◀</button>
              <span>{currentPage + 1} / {pages.length}</span>
              <button className="btn-secondary" onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + (viewMode.startsWith('double') ? 2 : 1)))}>▶</button>
            </>
          )}

          <button className="btn-secondary" onClick={handleSetThumbnail}>📷</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: viewMode === 'scroll' ? 'auto' : 'hidden', padding: viewMode === 'scroll' ? 0 : 8 }}>
        {renderContent()}
      </div>
    </div>
  )
}

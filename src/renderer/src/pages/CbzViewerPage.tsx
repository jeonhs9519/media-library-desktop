import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../useI18n'

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
  const { tr } = useI18n()

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

      // Save totalContent if not already saved
      if (!itemData.totalContent) {
        await window.api.items.update(itemId, { totalContent: pageList.length })
      }

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
    alert(tr('viewer.thumbnailUpdated'))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.cbz.loading')}</div>

  const renderContent = () => {
    if (viewMode === 'scroll') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          {pages.map((_, idx) => {
            const src = images[idx]
            if (!src) {
              return (
                <div key={idx} style={{ width: '100%', minHeight: 400, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span>{tr('viewer.cbz.loadingPage', { page: idx + 1 })}</span>
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
            : <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{tr('common.loading')}</div>
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
            : <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>{tr('common.loading')}</div>
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
        <span style={{ fontWeight: 'bold' }}>{item?.title}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['scroll', 'single', 'double-ltr', 'double-rtl'] as ViewMode[]).map(mode => (
            <button
              key={mode}
              className={viewMode === mode ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setViewMode(mode)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              {mode === 'scroll' ? `↕ ${tr('viewer.cbz.mode.scroll')}` : mode === 'single' ? `□ ${tr('viewer.cbz.mode.single')}` : mode === 'double-ltr' ? `□□→ ${tr('viewer.cbz.mode.doubleLtr')}` : `←□□ ${tr('viewer.cbz.mode.doubleRtl')}`}
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

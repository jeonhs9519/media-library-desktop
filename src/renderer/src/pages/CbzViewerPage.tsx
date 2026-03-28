import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../useI18n'
import { api } from '../api'
import BookViewerOverlay, { useBookViewerViewMode } from '../components/BookViewerOverlay/index'
import { useBookViewerOverlayUx } from '../components/BookViewerOverlay/useBookViewerOverlayUx.ts'
import { useBookViewerKeyboard } from '../components/BookViewerOverlay/useBookViewerKeyboard.ts'

const CBZ_VIEW_MODE_SETTING_KEY = 'cbz.viewMode'

export default function CbzViewerPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const itemId = parseInt(id!)

  const [item, setItem] = useState<any>(null)
  const [pages, setPages] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [images, setImages] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const { tr } = useI18n()
  const {
    viewMode,
    setViewMode,
    hydrateViewMode,
  } = useBookViewerViewMode(CBZ_VIEW_MODE_SETTING_KEY)
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
    const load = async () => {
      const itemData = await api.items.getById(itemId)
      setItem(itemData)

      await hydrateViewMode()

      const fullPath = getFullPath(itemData)
      const pageList = await api.cbz.getPages(fullPath)
      setPages(pageList)

      // Save totalContent if not already saved
      if (!itemData.totalContent) {
        await api.items.update(itemId, { totalContent: pageList.length })
      }

      const startPage = itemData.lastPageIndex || 0
      setCurrentPage(startPage)
      setLoading(false)
    }
    load().catch(console.error)
  }, [itemId, getFullPath, hydrateViewMode])

  useEffect(() => {
    if (!item || pages.length === 0) return

    const fullPath = getFullPath(item)

    const loadPage = async (idx: number) => {
      if (idx < 0 || idx >= pages.length || images[idx]) return
      try {
        const base64 = await api.cbz.getPage(fullPath, idx)
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
    api.items.update(itemId, { lastPageIndex: currentPage, progress }).catch(console.error)
  }, [currentPage, pages.length, itemId])

  useBookViewerKeyboard({
    viewMode,
    isContextMenuOpen,
    onViewModeChange: setViewMode,
    onPrevPage: (step) => setCurrentPage((p) => Math.max(0, p - step)),
    onNextPage: (step) => setCurrentPage((p) => Math.min(pages.length - 1, p + step)),
    onGoHome: () => setCurrentPage(0),
    onToggleFullscreen: toggleFullscreen,
    onExitViewer: () => navigate(`/items/${itemId}`),
  })

  const handleSetThumbnail = async () => {
    await api.thumbnail.setFromPage(itemId, currentPage)
    alert(tr('viewer.thumbnailUpdated'))
  }

  const handleShowInFolder = async () => {
    if (!item) return
    await api.file.showInFolder(getFullPath(item))
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.cbz.loading')}</div>

  const pageStep = viewMode.startsWith('double') ? 2 : 1
  const rightPageDisplay = Math.min(pages.length, currentPage + 2)
  const pageLabel = !viewMode.startsWith('double') || currentPage + 1 >= pages.length
    ? `${currentPage + 1} / ${pages.length}`
    : `${currentPage + 1}-${rightPageDisplay} / ${pages.length}`

  const goToPrevPage = () => {
    setCurrentPage(p => Math.max(0, p - pageStep))
  }

  const goToNextPage = () => {
    setCurrentPage(p => Math.min(pages.length - 1, p + pageStep))
  }

  const renderContent = () => {
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
      contextMenuId="cbz-context-menu"
    >
      <div style={{ height: '100%', overflow: 'hidden', padding: 8 }}>
        {renderContent()}
      </div>
    </BookViewerOverlay>
  )
}

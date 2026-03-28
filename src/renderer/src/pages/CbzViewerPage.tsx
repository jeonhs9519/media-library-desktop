import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useI18n } from '../useI18n'
import {
  CaretLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseXIcon,
  DoublePageLtrModeIcon,
  DoublePageRtlModeIcon,
  FullscreenIcon,
  FolderOpenIcon,
  SinglePageModeIcon,
  ThumbnailIcon,
} from '../components/icons'
import ContextMenu, { ContextMenuEntry } from '../components/ContextMenu/index'

type ViewMode = 'single' | 'double-ltr' | 'double-rtl'

const CBZ_VIEW_MODE_SETTING_KEY = 'cbz.viewMode'

function isViewMode(value: string | null): value is ViewMode {
  return value === 'single' || value === 'double-ltr' || value === 'double-rtl'
}

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
  const [isTopOverlayVisible, setIsTopOverlayVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [hasHydratedViewMode, setHasHydratedViewMode] = useState(false)
  const { tr } = useI18n()
  const overlayHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  const getFullPath = useCallback((itemData: any) => {
    return itemData.filePath + '/' + itemData.fileName +
      (itemData.fileExtension ? '.' + itemData.fileExtension : '')
  }, [])

  useEffect(() => {
    const load = async () => {
      const itemData = await window.api.items.getById(itemId)
      setItem(itemData)

      const savedViewMode = await window.api.settings.get(CBZ_VIEW_MODE_SETTING_KEY)
      if (isViewMode(savedViewMode)) {
        setViewMode(savedViewMode)
      }

      const fullPath = getFullPath(itemData)
      const pageList = await window.api.cbz.getPages(fullPath)
      setPages(pageList)

      // Save totalContent if not already saved
      if (!itemData.totalContent) {
        await window.api.items.update(itemId, { totalContent: pageList.length })
      }

      const startPage = itemData.lastPageIndex || 0
      setCurrentPage(startPage)
      setHasHydratedViewMode(true)
      setLoading(false)
    }
    load().catch(console.error)
  }, [itemId, getFullPath])

  useEffect(() => {
    if (!hasHydratedViewMode) return
    window.api.settings.set(CBZ_VIEW_MODE_SETTING_KEY, viewMode).catch?.(console.error)
  }, [viewMode, hasHydratedViewMode])

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
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen()
      return
    }
    document.exitFullscreen()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (contextMenu) return

      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const step = viewMode.startsWith('double') ? 2 : 1
      const goPrev = () => setCurrentPage(p => Math.max(0, p - step))
      const goNext = () => setCurrentPage(p => Math.min(pages.length - 1, p + step))
      const isPrevPageKey = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'].includes(e.code)

      if (e.key === '1') {
        setViewMode('single')
        return
      }

      if (e.key === '2') {
        setViewMode(prev => {
          if (prev === 'single') return 'double-ltr'
          return prev === 'double-ltr' ? 'double-rtl' : 'double-ltr'
        })
        return
      }

      if (isPrevPageKey) {
        goPrev()
        return
      }

      if (e.key === 'ArrowRight') {
        if (viewMode === 'double-rtl') {
          goPrev()
        } else {
          goNext()
        }
      } else if (e.key === 'ArrowLeft') {
        if (viewMode === 'double-rtl') {
          goNext()
        } else {
          goPrev()
        }
      } else if (e.key === 'ArrowUp') {
        goPrev()
      } else if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        goNext()
      } else if (e.key === 'Home') {
        setCurrentPage(0)
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        navigate(`/items/${itemId}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [viewMode, pages.length, itemId, navigate, contextMenu])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  useEffect(() => {
    return () => {
      clearTimeout(overlayHideTimer.current)
    }
  }, [])

  const showTopOverlay = () => {
    clearTimeout(overlayHideTimer.current)
    setIsTopOverlayVisible(true)
  }

  const hideTopOverlayWithDelay = () => {
    clearTimeout(overlayHideTimer.current)
    overlayHideTimer.current = setTimeout(() => {
      setIsTopOverlayVisible(false)
    }, 3000)
  }

  const handleSetThumbnail = async () => {
    await window.api.thumbnail.setFromPage(itemId, currentPage)
    alert(tr('viewer.thumbnailUpdated'))
  }

  const handleShowInFolder = async () => {
    if (!item) return
    await window.api.file.showInFolder(getFullPath(item))
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-primary)' }}>{tr('viewer.cbz.loading')}</div>

  const overlayTabIndex = isTopOverlayVisible ? 0 : -1
  const pageStep = viewMode.startsWith('double') ? 2 : 1
  const leftDirectionLabel = viewMode === 'double-rtl' ? tr('viewer.cbz.nextPage') : tr('viewer.cbz.prevPage')
  const rightDirectionLabel = viewMode === 'double-rtl' ? tr('viewer.cbz.prevPage') : tr('viewer.cbz.nextPage')
  const prevPageShortcutLabel = 'zxcvbnm,./'
  const nextPageShortcutLabel = tr('viewer.video.shortcut.space')
  const leftDirectionShortcut = viewMode === 'double-rtl' ? nextPageShortcutLabel : prevPageShortcutLabel
  const rightDirectionShortcut = viewMode === 'double-rtl' ? prevPageShortcutLabel : nextPageShortcutLabel

  const goToPrevPage = () => {
    setCurrentPage(p => Math.max(0, p - pageStep))
  }

  const goToNextPage = () => {
    setCurrentPage(p => Math.min(pages.length - 1, p + pageStep))
  }

  // Match left/right arrow-key experience in double-rtl mode.
  const handleLeftDirectionNavigation = () => {
    if (viewMode === 'double-rtl') {
      goToNextPage()
      return
    }
    goToPrevPage()
  }

  const handleRightDirectionNavigation = () => {
    if (viewMode === 'double-rtl') {
      goToPrevPage()
      return
    }
    goToNextPage()
  }

  const contextMenuItems: ContextMenuEntry[] = [
    {
      key: 'prev-page',
      label: leftDirectionLabel,
      icon: <ChevronLeftIcon size={16} />,
      shortcut: leftDirectionShortcut,
      onSelect: handleLeftDirectionNavigation,
    },
    {
      key: 'next-page',
      label: rightDirectionLabel,
      icon: <ChevronRightIcon size={16} />,
      shortcut: rightDirectionShortcut,
      onSelect: handleRightDirectionNavigation,
    },
    { key: 'sep-1', type: 'separator' },
    {
      key: 'page-mode',
      label: tr('viewer.cbz.mode.section'),
      description: '현재: ' + (
        viewMode === 'single'
          ? tr('viewer.cbz.mode.single')
          : viewMode === 'double-ltr'
            ? tr('viewer.cbz.mode.doubleLtr')
            : tr('viewer.cbz.mode.doubleRtl')
      ),
      children: [
        {
          key: 'single-mode',
          label: tr('viewer.cbz.mode.single'),
          icon: <SinglePageModeIcon size={16} />,
          shortcut: '1',
          tone: viewMode === 'single' ? 'accent' : 'default',
          checked: viewMode === 'single',
          onSelect: () => setViewMode('single'),
        },
        {
          key: 'double-mode-ltr',
          label: tr('viewer.cbz.mode.doubleLtr'),
          icon: <DoublePageLtrModeIcon size={16} />,
          shortcut: '2',
          tone: viewMode === 'double-ltr' ? 'accent' : 'default',
          checked: viewMode === 'double-ltr',
          onSelect: () => setViewMode('double-ltr'),
        },
        {
          key: 'double-mode-rtl',
          label: tr('viewer.cbz.mode.doubleRtl'),
          icon: <DoublePageRtlModeIcon size={16} />,
          shortcut: '2',
          tone: viewMode === 'double-rtl' ? 'accent' : 'default',
          checked: viewMode === 'double-rtl',
          onSelect: () => setViewMode('double-rtl'),
        },
      ],
    },
    {
      key: 'set-thumbnail',
      label: tr('viewer.setThumbnail'),
      icon: <ThumbnailIcon size={16} />,
      onSelect: handleSetThumbnail,
    },
    {
      key: 'fullscreen',
      label: tr('viewer.video.fullscreen'),
      icon: <FullscreenIcon size={16} />,
      shortcut: tr('viewer.video.shortcut.fullscreen'),
      tone: isFullscreen ? 'accent' : 'default',
      checked: isFullscreen,
      onSelect: toggleFullscreen,
    },
    { key: 'sep-2', type: 'separator' },
    {
      key: 'show-in-folder',
      label: tr('viewer.video.showInFolder'),
      icon: <FolderOpenIcon size={16} />,
      onSelect: handleShowInFolder,
    },
    {
      key: 'exit-viewer',
      label: tr('viewer.cbz.exitViewer'),
      icon: <CloseXIcon size={16} />,
      shortcut: 'Esc / Backspace',
      onSelect: () => navigate(`/items/${itemId}`),
    },
  ]

  const getGroupedButtonRadiusStyle = (hasPrevElement: boolean, hasNextElement: boolean): React.CSSProperties => ({
    borderTopLeftRadius: hasPrevElement ? 0 : 'var(--video-control-radius)',
    borderBottomLeftRadius: hasPrevElement ? 0 : 'var(--video-control-radius)',
    borderTopRightRadius: hasNextElement ? 0 : 'var(--video-control-radius)',
    borderBottomRightRadius: hasNextElement ? 0 : 'var(--video-control-radius)',
  })

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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }} onContextMenu={handleContextMenu}>
      <div
        style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}
        onMouseEnter={showTopOverlay}
        onMouseMove={showTopOverlay}
        onMouseLeave={hideTopOverlayWithDelay}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            zIndex: 21,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '100%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.9) 28%, rgba(0,0,0,0.74) 58%, rgba(0,0,0,0.44) 78%, rgba(0,0,0,0.18) 92%, rgba(0,0,0,0) 100%)',
            opacity: isTopOverlayVisible ? 1 : 0,
            transform: isTopOverlayVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: isTopOverlayVisible ? 'auto' : 'none',
          }}
        >
          <div
            style={{
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              padding: '0 12px',
              paddingRight: 150,
              WebkitAppRegion: 'drag',
            } as any}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: 0.2 }}>{tr('app.title')}</span>
          </div>

          <div style={{
            padding: '16px 12px',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <button
              className="video-control-button"
              tabIndex={overlayTabIndex}
              onClick={() => navigate(`/items/${itemId}`)}
              title={tr('common.back')}
              aria-label={tr('common.back')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 2px',
                color: '#fff',
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
            >
              <CaretLeftIcon size={24} />
            </button>
            <span style={{ fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item?.title}</span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {(['single', 'double-ltr', 'double-rtl'] as ViewMode[]).map((mode, index, arr) => (
                  <button
                    key={mode}
                    className="video-control-button"
                    tabIndex={overlayTabIndex}
                    onClick={() => setViewMode(mode)}
                    title={
                      mode === 'single'
                        ? tr('viewer.cbz.mode.single')
                        : mode === 'double-ltr'
                          ? tr('viewer.cbz.mode.doubleLtr')
                          : tr('viewer.cbz.mode.doubleRtl')
                    }
                    aria-label={
                      mode === 'single'
                        ? tr('viewer.cbz.mode.single')
                        : mode === 'double-ltr'
                          ? tr('viewer.cbz.mode.doubleLtr')
                          : tr('viewer.cbz.mode.doubleRtl')
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 2px',
                      color: viewMode === mode ? '#4a9eff' : '#d2d8e2',
                      background: viewMode === mode ? 'rgba(74, 158, 255, 0.14)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      ...getGroupedButtonRadiusStyle(index > 0, index < arr.length - 1),
                    }}
                  >
                    {mode === 'single'
                      ? <SinglePageModeIcon size={24} />
                      : mode === 'double-ltr'
                        ? <DoublePageLtrModeIcon size={24} />
                        : <DoublePageRtlModeIcon size={24} />}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={handleLeftDirectionNavigation}
                  title={leftDirectionLabel}
                  aria-label={leftDirectionLabel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 2px',
                    color: '#fff',
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    ...getGroupedButtonRadiusStyle(false, true),
                  }}
                >
                  <ChevronLeftIcon size={24} />
                </button>
                <span>{currentPage + 1} / {pages.length}</span>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={handleRightDirectionNavigation}
                  title={rightDirectionLabel}
                  aria-label={rightDirectionLabel}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 2px',
                    color: '#fff',
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    ...getGroupedButtonRadiusStyle(true, false),
                  }}
                >
                  <ChevronRightIcon size={24} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={handleSetThumbnail}
                  title={tr('viewer.setThumbnail')}
                  aria-label={tr('viewer.setThumbnail')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 2px',
                    color: '#fff',
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    ...getGroupedButtonRadiusStyle(false, false),
                  }}
                >
                  <ThumbnailIcon size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ height: '100%', overflow: 'hidden', padding: 8 }}>
          {renderContent()}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          id="cbz-context-menu"
          position={contextMenu}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
          minWidth={300}
        />
      )}
    </div>
  )
}

import React from 'react'
import { useI18n } from '../../useI18n'
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
} from '../icons'
import ContextMenu, { ContextMenuEntry } from '../ContextMenu/index'

export type BookViewerViewMode = 'single' | 'double-ltr' | 'double-rtl'

export { useBookViewerViewMode } from './useBookViewerViewMode'

type BookViewerOverlayProps = {
  containerRef: React.RefObject<HTMLDivElement | null>
  isTopOverlayVisible: boolean
  onMouseEnter: () => void
  onMouseMove: () => void
  onMouseLeave: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onBack: () => void
  itemTitle?: string
  viewMode: BookViewerViewMode
  onViewModeChange: (mode: BookViewerViewMode) => void
  pageLabel: string
  onPrevPage: () => void
  onNextPage: () => void
  onSetThumbnail: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onShowInFolder: () => void
  onExitViewer: () => void
  contextMenu: { x: number; y: number } | null
  onCloseContextMenu: () => void
  contextMenuId: string
  children: React.ReactNode
}

const CONTAINER_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  background: 'var(--bg-primary)',
}

const CONTENT_WRAPPER_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
}

const OVERLAY_GRADIENT_STYLE: React.CSSProperties = {
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
}

const HEADER_STYLE: React.CSSProperties & { WebkitAppRegion: string } = {
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '0 12px',
  paddingRight: 150,
  WebkitAppRegion: 'drag',
}

const APP_TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  letterSpacing: 0.2,
}

const CONTROL_BUTTONS_CONTAINER_STYLE: React.CSSProperties = {
  padding: '16px 12px',
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  flexWrap: 'wrap',
}

const BUTTON_BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 2px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
}

const BACK_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  color: '#fff',
  boxShadow: 'none',
}

const MODE_BUTTON_STYLE = (isActive: boolean): React.CSSProperties => ({
  ...BUTTON_BASE_STYLE,
  color: isActive ? '#4a9eff' : '#d2d8e2',
  background: isActive ? 'rgba(74, 158, 255, 0.14)' : 'transparent',
})

const DIRECTION_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  color: '#fff',
}

const THUMBNAIL_BUTTON_STYLE: React.CSSProperties = {
  ...BUTTON_BASE_STYLE,
  color: '#fff',
}

const BUTTON_GROUP_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const TITLE_SPAN_STYLE: React.CSSProperties = {
  fontWeight: 'bold',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const CONTROLS_RIGHT_STYLE: React.CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  gap: 16,
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
}

function getGroupedButtonRadiusStyle(hasPrevElement: boolean, hasNextElement: boolean): React.CSSProperties {
  return {
    borderTopLeftRadius: hasPrevElement ? 0 : 'var(--video-control-radius)',
    borderBottomLeftRadius: hasPrevElement ? 0 : 'var(--video-control-radius)',
    borderTopRightRadius: hasNextElement ? 0 : 'var(--video-control-radius)',
    borderBottomRightRadius: hasNextElement ? 0 : 'var(--video-control-radius)',
  }
}

export default function BookViewerOverlay({
  containerRef,
  isTopOverlayVisible,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onContextMenu,
  onBack,
  itemTitle,
  viewMode,
  onViewModeChange,
  pageLabel,
  onPrevPage,
  onNextPage,
  onSetThumbnail,
  isFullscreen,
  onToggleFullscreen,
  onShowInFolder,
  onExitViewer,
  contextMenu,
  onCloseContextMenu,
  contextMenuId,
  children,
}: BookViewerOverlayProps) {
  const { tr } = useI18n()
  const labels = {
    appTitle: tr('app.title'),
    back: tr('common.back'),
    modeSection: tr('viewer.cbz.mode.section'),
    modeSingle: tr('viewer.cbz.mode.single'),
    modeDoubleLtr: tr('viewer.cbz.mode.doubleLtr'),
    modeDoubleRtl: tr('viewer.cbz.mode.doubleRtl'),
    currentPrefix: tr('viewer.currentPrefix'),
    setThumbnail: tr('viewer.setThumbnail'),
    fullscreen: tr('viewer.video.fullscreen'),
    fullscreenShortcut: tr('viewer.video.shortcut.fullscreen'),
    showInFolder: tr('viewer.video.showInFolder'),
    exitViewer: tr('viewer.cbz.exitViewer'),
  }
  const leftDirectionLabel = viewMode === 'double-rtl' ? tr('viewer.cbz.nextPage') : tr('viewer.cbz.prevPage')
  const rightDirectionLabel = viewMode === 'double-rtl' ? tr('viewer.cbz.prevPage') : tr('viewer.cbz.nextPage')
  const prevPageShortcutLabel = 'zxcvbnm,./'
  const nextPageShortcutLabel = tr('viewer.video.shortcut.space')
  const leftDirectionShortcut = viewMode === 'double-rtl' ? nextPageShortcutLabel : prevPageShortcutLabel
  const rightDirectionShortcut = viewMode === 'double-rtl' ? prevPageShortcutLabel : nextPageShortcutLabel
  const overlayTabIndex = isTopOverlayVisible ? 0 : -1

  const handleLeftDirectionNavigation = () => {
    if (viewMode === 'double-rtl') {
      onNextPage()
      return
    }
    onPrevPage()
  }

  const handleRightDirectionNavigation = () => {
    if (viewMode === 'double-rtl') {
      onPrevPage()
      return
    }
    onNextPage()
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
      label: labels.modeSection,
      description: labels.currentPrefix + (
        viewMode === 'single'
          ? labels.modeSingle
          : viewMode === 'double-ltr'
            ? labels.modeDoubleLtr
            : labels.modeDoubleRtl
      ),
      children: [
        {
          key: 'single-mode',
          label: labels.modeSingle,
          icon: <SinglePageModeIcon size={16} />,
          shortcut: '1',
          tone: viewMode === 'single' ? 'accent' : 'default',
          checked: viewMode === 'single',
          onSelect: () => onViewModeChange('single'),
        },
        {
          key: 'double-mode-ltr',
          label: labels.modeDoubleLtr,
          icon: <DoublePageLtrModeIcon size={16} />,
          shortcut: '2',
          tone: viewMode === 'double-ltr' ? 'accent' : 'default',
          checked: viewMode === 'double-ltr',
          onSelect: () => onViewModeChange('double-ltr'),
        },
        {
          key: 'double-mode-rtl',
          label: labels.modeDoubleRtl,
          icon: <DoublePageRtlModeIcon size={16} />,
          shortcut: '2',
          tone: viewMode === 'double-rtl' ? 'accent' : 'default',
          checked: viewMode === 'double-rtl',
          onSelect: () => onViewModeChange('double-rtl'),
        },
      ],
    },
    {
      key: 'set-thumbnail',
      label: labels.setThumbnail,
      icon: <ThumbnailIcon size={16} />,
      onSelect: onSetThumbnail,
    },
    {
      key: 'fullscreen',
      label: labels.fullscreen,
      icon: <FullscreenIcon size={16} />,
      shortcut: labels.fullscreenShortcut,
      tone: isFullscreen ? 'accent' : 'default',
      checked: isFullscreen,
      onSelect: onToggleFullscreen,
    },
    { key: 'sep-2', type: 'separator' },
    {
      key: 'show-in-folder',
      label: labels.showInFolder,
      icon: <FolderOpenIcon size={16} />,
      onSelect: onShowInFolder,
    },
    {
      key: 'exit-viewer',
      label: labels.exitViewer,
      icon: <CloseXIcon size={16} />,
      shortcut: 'Esc / Backspace',
      onSelect: onExitViewer,
    },
  ]

  return (
    <div
      ref={containerRef}
      style={CONTAINER_STYLE}
      onContextMenu={onContextMenu}
    >
      <div
        style={CONTENT_WRAPPER_STYLE}
        onMouseEnter={onMouseEnter}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        <div
          style={{
            ...OVERLAY_GRADIENT_STYLE,
            opacity: isTopOverlayVisible ? 1 : 0,
            transform: isTopOverlayVisible ? 'translateY(0)' : 'translateY(-6px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: isTopOverlayVisible ? 'auto' : 'none',
          }}
        >
          <div style={HEADER_STYLE}>
            <span style={APP_TITLE_STYLE}>{labels.appTitle}</span>
          </div>

          <div style={CONTROL_BUTTONS_CONTAINER_STYLE}>
            <button
              className="video-control-button"
              tabIndex={overlayTabIndex}
              onClick={onBack}
              title={labels.back}
              aria-label={labels.back}
              style={BACK_BUTTON_STYLE}
            >
              <CaretLeftIcon size={24} />
            </button>
            <span style={TITLE_SPAN_STYLE}>{itemTitle}</span>

            <div style={CONTROLS_RIGHT_STYLE}>
              <div style={BUTTON_GROUP_STYLE}>
                {(['single', 'double-ltr', 'double-rtl'] as BookViewerViewMode[]).map((mode, index, arr) => (
                  <button
                    key={mode}
                    className="video-control-button"
                    tabIndex={overlayTabIndex}
                    onClick={() => onViewModeChange(mode)}
                    title={
                      mode === 'single'
                        ? labels.modeSingle
                        : mode === 'double-ltr'
                          ? labels.modeDoubleLtr
                          : labels.modeDoubleRtl
                    }
                    aria-label={
                      mode === 'single'
                        ? labels.modeSingle
                        : mode === 'double-ltr'
                          ? labels.modeDoubleLtr
                          : labels.modeDoubleRtl
                    }
                    style={{
                      ...MODE_BUTTON_STYLE(viewMode === mode),
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

              <div style={BUTTON_GROUP_STYLE}>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={handleLeftDirectionNavigation}
                  title={leftDirectionLabel}
                  aria-label={leftDirectionLabel}
                  style={{
                    ...DIRECTION_BUTTON_STYLE,
                    ...getGroupedButtonRadiusStyle(false, true),
                  }}
                >
                  <ChevronLeftIcon size={24} />
                </button>
                <span>{pageLabel}</span>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={handleRightDirectionNavigation}
                  title={rightDirectionLabel}
                  aria-label={rightDirectionLabel}
                  style={{
                    ...DIRECTION_BUTTON_STYLE,
                    ...getGroupedButtonRadiusStyle(true, false),
                  }}
                >
                  <ChevronRightIcon size={24} />
                </button>
              </div>

              <div style={BUTTON_GROUP_STYLE}>
                <button
                  className="video-control-button"
                  tabIndex={overlayTabIndex}
                  onClick={onSetThumbnail}
                  title={labels.setThumbnail}
                  aria-label={labels.setThumbnail}
                  style={{
                    ...THUMBNAIL_BUTTON_STYLE,
                    ...getGroupedButtonRadiusStyle(false, false),
                  }}
                >
                  <ThumbnailIcon size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {children}
      </div>

      {contextMenu && (
        <ContextMenu
          id={contextMenuId}
          position={contextMenu}
          items={contextMenuItems}
          onClose={onCloseContextMenu}
          minWidth={300}
        />
      )}
    </div>
  )
}
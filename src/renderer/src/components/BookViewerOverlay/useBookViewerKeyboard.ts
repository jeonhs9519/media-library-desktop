import { useEffect } from 'react'
import type { BookViewerViewMode } from './index'

type UseBookViewerKeyboardParams = {
  viewMode: BookViewerViewMode
  isContextMenuOpen: boolean
  onViewModeChange: (next: BookViewerViewMode | ((prev: BookViewerViewMode) => BookViewerViewMode)) => void
  onPrevPage: (step: number) => void
  onNextPage: (step: number) => void
  onGoHome: () => void
  onToggleFullscreen: () => void
  onExitViewer: () => void
  onPlaylistPrevious?: () => void
  onPlaylistNext?: () => void
  onTogglePlaylist?: () => void
  onScrollUp?: () => void
  onScrollDown?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
}

export function useBookViewerKeyboard({
  viewMode,
  isContextMenuOpen,
  onViewModeChange,
  onPrevPage,
  onNextPage,
  onGoHome,
  onToggleFullscreen,
  onExitViewer,
  onPlaylistPrevious,
  onPlaylistNext,
  onTogglePlaylist,
  onScrollUp,
  onScrollDown,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: UseBookViewerKeyboardParams) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isContextMenuOpen) return

      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      if (viewMode === 'scroll' && !e.ctrlKey && !e.metaKey && !e.altKey && ['+', '-', '0'].includes(e.key)) {
        e.preventDefault()
        if (e.key === '+') onZoomIn?.()
        else if (e.key === '-') onZoomOut?.()
        else onZoomReset?.()
        return
      }

      if (viewMode === 'scroll' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) e.preventDefault()
      const step = viewMode.startsWith('double') ? 2 : 1
      const goPrev = () => onPrevPage(step)
      const goNext = () => onNextPage(step)
      const isPrevPageKey = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'].includes(e.code)

      if (e.key === 'PageUp') {
        e.preventDefault()
        onPlaylistPrevious?.()
        return
      }

      if (e.key === 'PageDown') {
        e.preventDefault()
        onPlaylistNext?.()
        return
      }

      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        onTogglePlaylist?.()
        return
      }

      if (e.key === '1') {
        e.preventDefault()
        onViewModeChange(previous => previous === 'single' ? 'scroll' : 'single')
        return
      }

      if (e.key === '2') {
        onViewModeChange((prev) => {
          if (prev === 'single') return 'double-ltr'
          return prev === 'double-ltr' ? 'double-rtl' : 'double-ltr'
        })
        return
      }

      if (isPrevPageKey) {
        if (viewMode === 'scroll') {
          e.preventDefault()
          onScrollUp?.()
        } else goPrev()
        return
      }

      if (viewMode === 'scroll' && e.key === 'ArrowUp') {
        e.preventDefault()
        onScrollUp?.()
        return
      }

      if (viewMode === 'scroll' && (e.key === 'ArrowDown' || e.key === ' ')) {
        e.preventDefault()
        onScrollDown?.()
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
        onGoHome()
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
        e.preventDefault()
        onToggleFullscreen()
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault()
        onExitViewer()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    viewMode,
    isContextMenuOpen,
    onViewModeChange,
    onPrevPage,
    onNextPage,
    onGoHome,
    onToggleFullscreen,
    onExitViewer,
    onPlaylistPrevious,
    onPlaylistNext,
    onTogglePlaylist,
    onScrollUp,
    onScrollDown,
    onZoomIn,
    onZoomOut,
    onZoomReset,
  ])
}

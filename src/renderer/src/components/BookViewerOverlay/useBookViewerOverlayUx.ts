import { useEffect, useRef, useState } from 'react'

export function useBookViewerOverlayUx() {
  const [isTopOverlayVisible, setIsTopOverlayVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const overlayHideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

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

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen()
      return
    }
    document.exitFullscreen()
  }

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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return {
    containerRef,
    isTopOverlayVisible,
    isFullscreen,
    contextMenu,
    isContextMenuOpen: contextMenu !== null,
    toggleFullscreen,
    showTopOverlay,
    hideTopOverlayWithDelay,
    handleContextMenu,
    closeContextMenu: () => setContextMenu(null),
  }
}

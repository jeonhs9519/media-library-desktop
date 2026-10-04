import { useEffect, useRef, useState } from 'react'
import { useViewerIdle } from '../../useViewerIdle'

export function useBookViewerOverlayUx() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const idle = useViewerIdle(contextMenu !== null)
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

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen()
      return
    }
    document.exitFullscreen()
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return {
    containerRef,
    isTopOverlayVisible: idle.visible,
    isFullscreen,
    contextMenu,
    isContextMenuOpen: contextMenu !== null,
    toggleFullscreen,
    showTopOverlay: idle.show,
    hideTopOverlayWithDelay: idle.scheduleHide,
    handleContextMenu,
    closeContextMenu: () => setContextMenu(null),
  }
}

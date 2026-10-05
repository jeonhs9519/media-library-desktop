import { useCallback, useEffect, useRef, useState } from 'react'

export const VIEWER_IDLE_DELAY = 2400

export function useViewerIdle(blocked = false, keyboardMode: 'all' | 'toolbar' = 'all') {
  const [visible, setVisible] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scheduleHide = useCallback(() => {
    clearTimeout(timer.current)
    if (!blocked) timer.current = setTimeout(() => setVisible(false), VIEWER_IDLE_DELAY)
  }, [blocked])
  const show = useCallback(() => {
    setVisible(true)
    scheduleHide()
  }, [scheduleHide])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (keyboardMode === 'all' || event.key === 'Tab' || event.key === 'ContextMenu'
        || (event.key === 'F10' && event.shiftKey)) show()
    }
    show()
    document.addEventListener('mousemove', show)
    document.addEventListener('pointerdown', show)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('focus', show)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('mousemove', show)
      document.removeEventListener('pointerdown', show)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('focus', show)
    }
  }, [show, keyboardMode])

  return { visible, show, scheduleHide }
}

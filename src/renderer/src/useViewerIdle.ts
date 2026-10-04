import { useCallback, useEffect, useRef, useState } from 'react'

export const VIEWER_IDLE_DELAY = 2400

export function useViewerIdle(blocked = false) {
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
    show()
    document.addEventListener('mousemove', show)
    document.addEventListener('pointerdown', show)
    document.addEventListener('keydown', show, true)
    window.addEventListener('focus', show)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('mousemove', show)
      document.removeEventListener('pointerdown', show)
      document.removeEventListener('keydown', show, true)
      window.removeEventListener('focus', show)
    }
  }, [show])

  return { visible, show, scheduleHide }
}

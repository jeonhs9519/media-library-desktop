import React, { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import LibraryPage from '../pages/LibraryPage'

export default function LibraryLayout({ fallback }: { fallback?: ReactNode }) {
  const active = !useLocation().pathname.startsWith('/view/')
  const [visited, setVisited] = useState(active)
  const scrollPositions = useRef(new Map<HTMLElement, { top: number; left: number }>())
  const restoring = useRef(false)
  useEffect(() => { if (active) setVisited(true) }, [active])
  useLayoutEffect(() => {
    if (!active) return
    restoring.current = true
    const positions = [...scrollPositions.current]
    const restore = () => positions.forEach(([element, position]) => {
      element.scrollTop = position.top
      element.scrollLeft = position.left
    })
    restore()
    const frame = requestAnimationFrame(() => { restore(); restoring.current = false })
    return () => { cancelAnimationFrame(frame); restoring.current = false }
  }, [active])
  return <>
    {(visited || active) && <div aria-hidden={!active} inert={!active}
      style={active ? undefined : { position: 'fixed', inset: 0, visibility: 'hidden', opacity: 0, pointerEvents: 'none' }}
      onScrollCapture={event => {
      if (!active || restoring.current || !(event.target instanceof HTMLElement)) return
      const element = event.target
      if (element.classList.contains('library-list-scroll')) {
        scrollPositions.current.set(element, { top: element.scrollTop, left: element.scrollLeft })
      }
    }}><LibraryPage active={active} /></div>}
    <Suspense fallback={fallback}><Outlet /></Suspense>
  </>
}

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  createBookScrollLayout,
  normalizeScrollOffset,
  type BookPageSize,
} from '../bookScrollModel'

export const BOOK_SCROLL_MAX_WIDTH = 1000
export type BookScrollHandle = {
  scrollByHalfPage: (direction: 'up' | 'down') => void
  goToPage: (page: number) => void
}
type Props = {
  count: number
  page: number
  zoom: number
  initialOffset: number
  pageSizes?: Record<number, BookPageSize>
  onPageChange: (page: number) => void
  onPositionChange: (page: number, offset: number) => void
  onVisibleRangeChange?: (start: number, count: number) => void
  renderPage: (
    page: number,
    width: number,
    reportSize: (page: number, width: number, height: number) => void
  ) => React.ReactNode
}

const BookScrollView = forwardRef<BookScrollHandle, Props>(function BookScrollView(
  {
    count,
    page,
    zoom,
    initialOffset,
    pageSizes,
    onPageChange,
    onPositionChange,
    onVisibleRangeChange,
    renderPage,
  },
  ref
) {
  const host = useRef<HTMLDivElement>(null)
  const anchor = useRef({ page, offset: normalizeScrollOffset(initialOffset) })
  const restoring = useRef(true)
  const callbacks = useRef({ onPageChange, onPositionChange, onVisibleRangeChange })
  callbacks.current = { onPageChange, onPositionChange, onVisibleRangeChange }
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [measured, setMeasured] = useState<Record<number, BookPageSize>>({})
  const sizes = useMemo(() => ({ ...measured, ...pageSizes }), [measured, pageSizes])
  const pageWidth = Math.max(1, Math.min(size.width - 16, BOOK_SCROLL_MAX_WIDTH) * zoom)
  const layout = useMemo(
    () => createBookScrollLayout(count, pageWidth, size.height, sizes),
    [count, pageWidth, size.height, sizes]
  )
  const currentLayout = useRef(layout)
  currentLayout.current = layout
  const currentSizes = useRef(sizes)
  currentSizes.current = sizes
  const [range, setRange] = useState({
    first: Math.max(0, page - 1),
    last: Math.min(count - 1, page + 1),
    start: page,
    visibleCount: 1,
  })
  const frame = useRef<number | null>(null)
  const stopAnimation = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  useEffect(() => stopAnimation, [stopAnimation])
  useLayoutEffect(() => {
    const element = host.current!
    const observer = new ResizeObserver(() => {
      const next = { width: element.getBoundingClientRect().width, height: element.clientHeight }
      setSize((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const updateRange = useCallback(
    (offset: number) => {
      const geometry = currentLayout.current
      const element = host.current!
      const start = geometry.locate(offset).page
      const end = geometry.locate(offset + element.clientHeight - 1).page
      const first = Math.max(
        0,
        geometry.locate(Math.max(0, offset - element.clientHeight)).page - 1
      )
      const last = Math.min(count - 1, geometry.locate(offset + element.clientHeight * 2).page + 1)
      setRange((previous) =>
        previous.first === first &&
        previous.last === last &&
        previous.start === start &&
        previous.visibleCount === end - start + 1
          ? previous
          : { first, last, start, visibleCount: end - start + 1 }
      )
    },
    [count]
  )
  const recordPosition = useCallback(() => {
    const element = host.current!
    const position = currentLayout.current.locate(element.scrollTop)
    updateRange(element.scrollTop)
    if (restoring.current) return
    const oldPage = anchor.current.page
    anchor.current = position
    if (position.page !== oldPage) callbacks.current.onPageChange(position.page)
    if (currentSizes.current[position.page])
      callbacks.current.onPositionChange(position.page, position.offset)
  }, [updateRange])
  useEffect(() => {
    callbacks.current.onVisibleRangeChange?.(range.start, range.visibleCount)
  }, [range.start, range.visibleCount])
  // 스크롤로 현재 페이지가 바뀔 때는 위치를 다시 대입하지 않아 애니메이션을 유지합니다.
  useLayoutEffect(() => {
    if (!size.height) return
    const element = host.current!
    if (page !== anchor.current.page) {
      stopAnimation()
      anchor.current = { page, offset: 0 }
      restoring.current = true
    }
    const geometry = currentLayout.current
    element.scrollTop =
      geometry.tops[anchor.current.page] +
      geometry.heights[anchor.current.page] * anchor.current.offset
    updateRange(element.scrollTop)
    if (currentSizes.current[anchor.current.page]) {
      restoring.current = false
      recordPosition()
    }
  }, [layout, pageWidth, size.height, stopAnimation, updateRange, recordPosition])
  useLayoutEffect(() => {
    if (!size.height || page === anchor.current.page) return
    stopAnimation()
    anchor.current = { page, offset: 0 }
    restoring.current = !currentSizes.current[page]
    host.current!.scrollTop = layout.tops[page]
    updateRange(host.current!.scrollTop)
    recordPosition()
  }, [page, size.height, layout, stopAnimation, updateRange, recordPosition])
  useImperativeHandle(
    ref,
    () => ({
      goToPage: (index) => {
        stopAnimation()
        anchor.current = { page: index, offset: 0 }
        restoring.current = !currentSizes.current[index]
        host.current!.scrollTop = currentLayout.current.tops[index]
        callbacks.current.onPageChange(index)
        updateRange(host.current!.scrollTop)
        recordPosition()
      },
      scrollByHalfPage: (direction) => {
        const element = host.current
        if (!element || restoring.current) return
        stopAnimation()
        const distance = element.clientHeight * 0.5 * (direction === 'down' ? 1 : -1)
        const started = performance.now()
        let previousEase = 0
        const animate = (now: number) => {
          const elapsed = Math.min(1, (now - started) / 240)
          const ease = 1 - (1 - elapsed) ** 3
          element.scrollTop += distance * (ease - previousEase)
          previousEase = ease
          recordPosition()
          frame.current = elapsed < 1 ? requestAnimationFrame(animate) : null
        }
        frame.current = requestAnimationFrame(animate)
      },
    }),
    [recordPosition, stopAnimation, updateRange]
  )
  const reportSize = useCallback((index: number, width: number, height: number) => {
    if (!(width > 0 && height > 0)) return
    setMeasured((previous) =>
      previous[index]?.width === width && previous[index]?.height === height
        ? previous
        : { ...previous, [index]: { width, height } }
    )
  }, [])
  return (
    <div
      ref={host}
      data-book-scroller
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        overflowAnchor: 'none',
        scrollbarGutter: 'stable',
      }}
      onScroll={recordPosition}
      onWheel={stopAnimation}
      onPointerDown={stopAnimation}
      onTouchStart={stopAnimation}
    >
      {size.height > 0 && (
        <div
          style={{
            height: layout.tops[count],
            width: Math.max(size.width - 16, pageWidth),
            position: 'relative',
          }}
        >
          {Array.from(
            { length: range.last - range.first + 1 },
            (_, offset) => range.first + offset
          ).map((index) => (
            <div
              key={index}
              data-book-page={index}
              style={{
                position: 'absolute',
                top: layout.tops[index],
                height: layout.heights[index],
                width: pageWidth,
                left: Math.max(0, (size.width - 16 - pageWidth) / 2),
                margin: 0,
                padding: 0,
                overflow: 'hidden',
              }}
            >
              {renderPage(index, pageWidth, reportSize)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

export default BookScrollView

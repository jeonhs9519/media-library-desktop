import React, { useId, useLayoutEffect, useRef, useState } from 'react'
import { getTooltipBoundary, getTooltipLeft, TooltipBoundary } from './positioning'

interface Props {
  content: React.ReactNode
  children: React.ReactElement<{ 'aria-describedby'?: string }>
  width?: number
  containerSelector?: string
}

export default function Tooltip({ content, children, width = 240, containerSelector = '.tooltip-container' }: Props) {
  const id = useId()
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [left, setLeft] = useState<number | null>(null)
  const open = (hovered || focused) && !dismissed

  useLayoutEffect(() => {
    const anchor = anchorRef.current!
    const tooltip = tooltipRef.current!
    const container = anchor.parentElement?.closest<HTMLElement>(containerSelector)
    const update = () => {
      const anchorRect = anchor.getBoundingClientRect()
      const scale = anchor.offsetWidth ? anchorRect.width / anchor.offsetWidth : 1
      let boundary = { left: 0, right: document.documentElement.clientWidth }
      if (container) {
        const rect = container.getBoundingClientRect()
        const style = getComputedStyle(container)
        const containerScale = container.offsetWidth ? rect.width / container.offsetWidth : 1
        const borderLeft = parseFloat(style.borderLeftWidth) || 0
        const borderRight = parseFloat(style.borderRightWidth) || 0
        const box = container.dataset.tooltipBoundary
        const boundaryBox: TooltipBoundary = box === 'padding-box' || box === 'border-box' ? box : 'content-box'
        boundary = getTooltipBoundary({
          left: rect.left,
          right: rect.right,
          borderLeft: borderLeft * containerScale,
          borderRight: borderRight * containerScale,
          paddingLeft: (parseFloat(style.paddingLeft) || 0) * containerScale,
          paddingRight: (parseFloat(style.paddingRight) || 0) * containerScale,
          scrollbarWidth: Math.max(0, container.offsetWidth - container.clientWidth - borderLeft - borderRight) * containerScale,
        }, boundaryBox)
      }
      setLeft((getTooltipLeft(anchorRect.left, tooltip.getBoundingClientRect().width, boundary) - anchorRect.left) / scale)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(anchor)
    observer.observe(tooltip)
    if (container) observer.observe(container)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [width, content, containerSelector])

  return (
    <span ref={anchorRef} className="tooltip-anchor"
      onMouseEnter={() => { setHovered(true); setDismissed(false) }}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => { setFocused(true); setDismissed(false) }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
      onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.stopPropagation(); setDismissed(true) } }}
    >
      {React.cloneElement(children, { 'aria-describedby': [children.props['aria-describedby'], id].filter(Boolean).join(' ') })}
      <span ref={tooltipRef} id={id} className="tooltip-content" role="tooltip" data-open={open && left !== null ? 'true' : undefined} style={{ width, left: left ?? 0 }}>
        {content}
      </span>
    </span>
  )
}

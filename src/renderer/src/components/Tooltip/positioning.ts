export type TooltipBoundary = 'content-box' | 'padding-box' | 'border-box'

interface BoundaryMetrics {
  left: number
  right: number
  borderLeft: number
  borderRight: number
  paddingLeft: number
  paddingRight: number
  scrollbarWidth?: number
}

export function getTooltipBoundary(metrics: BoundaryMetrics, box: TooltipBoundary) {
  if (box === 'border-box') return { left: metrics.left, right: metrics.right }
  const left = metrics.left + metrics.borderLeft
  const right = metrics.right - metrics.borderRight - (metrics.scrollbarWidth ?? 0)
  return box === 'padding-box'
    ? { left, right }
    : { left: left + metrics.paddingLeft, right: right - metrics.paddingRight }
}

export function getTooltipLeft(anchorLeft: number, width: number, boundary: { left: number; right: number }) {
  const rightAligned = boundary.right - width
  if (rightAligned < boundary.left) return rightAligned
  return Math.max(boundary.left, Math.min(anchorLeft, rightAligned))
}

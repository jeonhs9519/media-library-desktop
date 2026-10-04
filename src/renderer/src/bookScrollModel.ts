export type BookPageSize = { width: number; height: number }
export type BookScrollPosition = { page: number; offset: number }

export function normalizeScrollZoom(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(3, Math.max(0.5, value)) : 1
}

export function normalizeScrollOffset(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}

export function createBookScrollLayout(
  count: number,
  width: number,
  estimate: number,
  sizes: Record<number, BookPageSize>
) {
  const heights = Array.from({ length: count }, (_, index) => {
    const size = sizes[index]
    return size?.width > 0 && size.height > 0
      ? Math.max(1, (width * size.height) / size.width)
      : Math.max(1, estimate)
  })
  const tops = [0]
  for (const height of heights) tops.push(tops[tops.length - 1] + height)
  const locate = (offset: number): BookScrollPosition => {
    let low = 0,
      high = Math.max(0, count - 1)
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if (tops[middle] <= offset) low = middle
      else high = middle - 1
    }
    return { page: low, offset: normalizeScrollOffset((offset - tops[low]) / (heights[low] || 1)) }
  }
  return { heights, tops, locate }
}

import type { Item } from '../../types'

function formatVideoProgress(currentRaw: number, totalRaw: number): string {
  const total = Math.max(0, Math.floor(totalRaw))
  const current = Math.min(total, Math.max(0, Math.floor(currentRaw)))

  if (total < 60) {
    return `00:${current.toString().padStart(2, '0')}/00:${total.toString().padStart(2, '0')}`
  }

  if (total < 3600) {
    const cm = Math.floor(current / 60)
      .toString()
      .padStart(2, '0')
    const cs = (current % 60).toString().padStart(2, '0')
    const tm = Math.floor(total / 60)
      .toString()
      .padStart(2, '0')
    const ts = (total % 60).toString().padStart(2, '0')
    return `${cm}:${cs}/${tm}:${ts}`
  }

  const ch = Math.floor(current / 3600)
    .toString()
    .padStart(2, '0')
  const cm = Math.floor((current % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const cs = (current % 60).toString().padStart(2, '0')
  const th = Math.floor(total / 3600)
    .toString()
    .padStart(2, '0')
  const tm = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, '0')
  const ts = (total % 60).toString().padStart(2, '0')
  return `${ch}:${cm}:${cs}/${th}:${tm}:${ts}`
}

export function formatProgressDetail(item: Item): string {
  const pct = Math.round(item.progress * 100)
  if (!item.totalContent) return `${pct}%`

  if (item.containerType === 'video') {
    const pos = item.lastPositionSeconds ?? 0
    return `${formatVideoProgress(pos, item.totalContent)} (${pct}%)`
  }

  // PDF/ZIP의 lastPageIndex는 0부터 시작합니다.
  const current = (item.lastPageIndex ?? 0) + 1
  const total = Math.round(item.totalContent)
  return `${current}p/${total}p (${pct}%)`
}

export function isReservedTagName(name: string, untaggedLabel: string) {
  const normalized = name.trim().toLocaleLowerCase()
  return ['미지정', 'untagged', '未指定', untaggedLabel.toLocaleLowerCase()].includes(normalized)
}

function getDisplayPathSeparator() {
  return /\bWin/i.test(navigator.platform) ? '\\' : '/'
}

function normalizeDisplayPath(input: string) {
  return input.replace(/[\\/]+/g, getDisplayPathSeparator())
}

export function buildDisplayItemPath(item: {
  filePath: string
  fileName: string
  fileExtension?: string
}) {
  const separator = getDisplayPathSeparator()
  const normalizedDir = normalizeDisplayPath(item.filePath).replace(/[\\/]+$/, '')
  const fileLabel = `${item.fileName}${item.fileExtension ? `.${item.fileExtension}` : ''}`
  return `${normalizedDir}${separator}${fileLabel}`
}

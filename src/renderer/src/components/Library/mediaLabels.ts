export function getContentTypeIcon(ct: string) {
  switch (ct) {
    case 'book': return 'B'
    case 'comic': return 'C'
    case 'video': return 'V'
    default: return 'F'
  }
}

export function getLanguageBadge(lang: string) {
  switch (lang) {
    case 'ko': return 'KOR'
    case 'ja': return 'JPN'
    case 'en': return 'ENG'
    case 'zh': return 'CHN'
    default: return ''
  }
}

export function getViewerPath(item: { id: number; containerType: string }) {
  if (item.containerType === 'pdf') return `/view/pdf/${item.id}`
  if (item.containerType === 'zip') return `/view/cbz/${item.id}`
  if (item.containerType === 'video') return `/view/video/${item.id}`
  return null
}

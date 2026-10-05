import type { Item } from './types'

export type LibraryUpdate = { id: number; fields: Record<string, unknown>; item?: Item }
const listeners = new Set<(update: LibraryUpdate) => void>()
export function subscribeLibraryUpdates(listener: (update: LibraryUpdate) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function publishLibraryUpdate(update: LibraryUpdate) {
  listeners.forEach(listener => listener(update))
}

const viewerFields = new Set(['progress', 'watched', 'lastPageIndex', 'lastPositionSeconds', 'totalContent', 'bookViewMode', 'bookScrollZoom', 'bookScrollOffset', 'thumbnail'])
const readingState = (item: Item) => item.watched === 1 || item.progress >= 0.9
  ? 'completed' : item.progress > 0 ? 'inProgress' : 'unread'

export function needsLibraryReload(update: LibraryUpdate, previous: Item | undefined, watchedState: string, sortBy: string) {
  if (sortBy === 'updatedAt') return true
  if (Object.keys(update.fields).some(field => !viewerFields.has(field))) return true
  if (watchedState !== 'all' && ('progress' in update.fields || 'watched' in update.fields)) {
    return !previous || !update.item || readingState(previous) !== readingState(update.item)
  }
  return false
}

export function patchLibraryItem(previous: Item, updated: Item): Item {
  // 목록에 포함된 필드만 반영해 상세 응답의 thumbnail 바이너리를 보관하지 않습니다.
  return Object.fromEntries(Object.entries(previous).map(([key, value]) =>
    [key, key in updated ? updated[key as keyof Item] : value])) as unknown as Item
}

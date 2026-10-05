const entries = new Map<number, { value?: string | null; pending?: Promise<string | null> }>()
const listeners = new Set<() => void>()
let revision = 0

function notify() {
  revision += 1
  listeners.forEach((listener) => listener())
}

export const subscribeThumbnails = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export const getThumbnailRevision = () => revision
export const peekThumbnail = (id: number) => entries.get(id)?.value

export function invalidateThumbnail(id?: number) {
  if (id === undefined) entries.clear()
  else entries.delete(id)
  notify()
}

export function loadThumbnail(id: number, fetch: () => Promise<string | null>): Promise<string | null> {
  const cached = entries.get(id)
  if (cached?.pending) return cached.pending
  if (cached && cached.value !== undefined) return Promise.resolve(cached.value)
  const entry: { value?: string | null; pending?: Promise<string | null> } = {}
  entries.set(id, entry)
  entry.pending = fetch().then((value) => {
    if (entries.get(id) === entry) {
      entry.value = value
      entry.pending = undefined
      notify()
    }
    return value
  }, (error) => {
    if (entries.get(id) === entry) entries.delete(id)
    throw error
  })
  return entry.pending
}

export const CBZ_IMAGE_BUDGET = 128 * 1024 * 1024
export type CachedCbzPage = { url: string; bytes: number }

export function getCbzPageWindow(currentPage: number, count: number, step: number) {
  const visible = Array.from({ length: step }, (_, offset) => currentPage + offset).filter(index => index >= 0 && index < count)
  const adjacent = [currentPage + step, currentPage - step].flatMap(start =>
    Array.from({ length: step }, (_, offset) => start + offset).filter(index => index >= 0 && index < count))
  return { visible, ordered: [...visible, ...adjacent] }
}

export class CbzPageCache {
  private entries = new Map<number, CachedCbzPage>()
  private visible: number[] = []
  private ordered: number[] = []
  private attempted = new Set<number>()
  private running = false
  private disposed = false

  constructor(
    private load: (index: number) => Promise<CachedCbzPage>,
    private release: (page: CachedCbzPage) => void,
    private changed: (images: Record<number, string>) => void,
    private failed: (index: number, error: unknown) => void,
    private budget = CBZ_IMAGE_BUDGET,
  ) {}

  get bytes() { return [...this.entries.values()].reduce((sum, page) => sum + page.bytes, 0) }

  update(currentPage: number, count: number, step: number) {
    if (this.disposed) return
    const window = getCbzPageWindow(currentPage, count, step)
    this.visible = window.visible
    this.ordered = window.ordered
    this.attempted.clear()
    for (const [index, page] of this.entries) {
      if (!this.ordered.includes(index)) {
        this.release(page)
        this.entries.delete(index)
      }
    }
    this.trim()
    this.emit()
    void this.pump()
  }

  private emit() {
    this.changed(Object.fromEntries([...this.entries].map(([index, page]) => [index, page.url])))
  }

  private trim() {
    for (const index of [...this.ordered].reverse()) {
      if (this.bytes <= this.budget) break
      const entry = this.entries.get(index)
      if (entry && !this.visible.includes(index)) {
        this.entries.delete(index)
        this.release(entry)
      }
    }
  }

  private async pump() {
    if (this.running || this.disposed) return
    this.running = true
    try {
      while (!this.disposed) {
        const index = this.ordered.find(index => !this.entries.has(index) && !this.attempted.has(index))
        if (index === undefined) break
        this.attempted.add(index)
        if (!this.visible.includes(index) && this.bytes >= this.budget) continue
        try {
          const page = await this.load(index)
          if (this.disposed || !this.ordered.includes(index)) {
            this.release(page)
            continue
          }
          if (!this.visible.includes(index) && this.bytes + page.bytes > this.budget) {
            this.release(page)
            continue
          }
          this.entries.set(index, page)
          this.trim()
          this.emit()
        } catch (error) {
          if (!this.disposed && this.ordered.includes(index)) this.failed(index, error)
        }
      }
    } finally {
      this.running = false
    }
  }

  dispose() {
    this.disposed = true
    for (const page of this.entries.values()) this.release(page)
    this.entries.clear()
  }
}

import { describe, expect, it, vi } from 'vitest'
import { CbzPageCache, getCbzPageWindow, type CachedCbzPage } from '../../src/renderer/src/cbzPageCache'

async function settle() { for (let turn = 0; turn < 20; turn++) await Promise.resolve() }
function deferred() {
  let resolve!: (page: CachedCbzPage) => void
  return { promise: new Promise<CachedCbzPage>(done => { resolve = done }), resolve: (page: CachedCbzPage) => resolve(page) }
}
function setup(bytes = 10, budget = 100) {
  const load = vi.fn(async (index: number) => ({ url: `page-${index}`, bytes }))
  const release = vi.fn(), changed = vi.fn(), failed = vi.fn()
  return { load, release, changed, failed, cache: new CbzPageCache(load, release, changed, failed, budget) }
}

describe('bounded ZIP image cache', () => {
  it('preloads a complete next and previous screen in display order, including boundary spreads', async () => {
    expect(getCbzPageWindow(4, 10, 2)).toEqual({ visible: [4, 5], ordered: [4, 5, 6, 7, 2, 3] })
    expect(getCbzPageWindow(9, 10, 2)).toEqual({ visible: [9], ordered: [9, 7, 8] })
    const state = setup()
    state.cache.update(4, 10, 2)
    await settle()
    expect(state.load.mock.calls.map(([index]) => index)).toEqual([4, 5, 6, 7, 2, 3])
    state.cache.update(6, 10, 2)
    await settle()
    expect(state.load.mock.calls.map(([index]) => index)).toEqual([4, 5, 6, 7, 2, 3, 8, 9])
    expect(state.release.mock.calls.map(([page]) => page.url)).toEqual(['page-2', 'page-3'])
    state.cache.dispose()
  })

  it('drops stale work after a jump and loads the latest visible screen first', async () => {
    const pending = deferred()
    const state = setup()
    state.load.mockImplementationOnce(() => pending.promise)
    state.cache.update(0, 100, 1)
    state.cache.update(80, 100, 2)
    pending.resolve({ url: 'stale', bytes: 10 })
    await settle()
    expect(state.release).toHaveBeenCalledWith({ url: 'stale', bytes: 10 })
    expect(state.load.mock.calls.map(([index]) => index)).toEqual([0, 80, 81, 82, 83, 78, 79])
    expect(state.changed.mock.calls.at(-1)?.[0]).not.toHaveProperty('0')
    state.cache.dispose()
  })

  it('respects the byte budget, retains visible oversized pages and trims a cached oversized page once it leaves the screen', async () => {
    const state = setup(60, 100)
    state.cache.update(4, 10, 2)
    await settle()
    expect(state.cache.bytes).toBe(120)
    expect(state.load.mock.calls.map(([index]) => index)).toEqual([4, 5])
    state.cache.update(5, 10, 1)
    await settle()
    expect(state.cache.bytes).toBe(60)
    expect(state.release).toHaveBeenCalledWith({ url: 'page-4', bytes: 60 })
    state.cache.dispose()
    expect(state.cache.bytes).toBe(0)
  })

  it('releases completed and in-flight resources without publishing after disposal', async () => {
    const pending = deferred()
    const state = setup()
    state.load.mockImplementationOnce(() => pending.promise)
    state.cache.update(0, 10, 1)
    state.changed.mockClear()
    state.cache.dispose()
    pending.resolve({ url: 'late', bytes: 10 })
    await settle()
    expect(state.release).toHaveBeenCalledWith({ url: 'late', bytes: 10 })
    expect(state.changed).not.toHaveBeenCalled()
  })

  it('reports page failures once and retries on a later navigation', async () => {
    const state = setup()
    state.load.mockRejectedValueOnce(new Error('decode failed'))
    state.cache.update(0, 10, 1)
    await settle()
    expect(state.failed).toHaveBeenCalledTimes(1)
    state.cache.update(0, 10, 1)
    await settle()
    expect(state.changed.mock.calls.at(-1)?.[0]).toHaveProperty('0', 'page-0')
    state.cache.dispose()
  })
})

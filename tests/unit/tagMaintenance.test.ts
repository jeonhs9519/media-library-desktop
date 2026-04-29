import { describe, expect, it } from 'vitest'
import { cleanupUnusedTags } from '../../src/main/services/tagMaintenance'

describe('cleanupUnusedTags', () => {
  it('returns the number of deleted unused tags', () => {
    let whereCalled = false
    const db = {
      delete: () => ({
        where: () => {
          whereCalled = true
          return {
            run: () => ({ changes: 2 }),
          }
        },
      }),
    }

    expect(cleanupUnusedTags(db as any)).toEqual({ deleted: 2 })
    expect(whereCalled).toBe(true)
  })
})

import { useEffect, useRef } from 'react'
import { api } from '../../../api'

type MetadataFillStatus = {
  running: boolean
  queued: number
  processed: number
  updated: number
  failed: number
}

type Params = {
  total: number
  loadItems: () => Promise<void>
  refreshVersion?: number
}

export function useLibraryMetadataFill({ total, loadItems, refreshVersion = 0 }: Params) {
  const latestLoadItems = useRef(loadItems)
  latestLoadItems.current = loadItems
  const enabled = total > 0 || refreshVersion > 0

  useEffect(() => {
    if (!enabled) return
    let canceled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let resume: (() => void) | undefined
    const waitForCompletion = async (initial: MetadataFillStatus) => {
      let status = initial
      while (status.running && !canceled) {
        await new Promise<void>(resolve => {
          resume = resolve
          timer = setTimeout(() => { resume = undefined; resolve() }, 1000)
        })
        if (canceled) break
        status = await api.items.getMetadataFillStatus() as MetadataFillStatus
      }
      return status
    }

    const startBackgroundFill = async () => {
      try {
        const current = await api.items.getMetadataFillStatus() as MetadataFillStatus
        if (canceled) return
        let changed = false
        if (current.running) {
          const completed = await waitForCompletion(current)
          changed = completed.updated > 0
        }
        if (canceled) return
        // 진행 중인 작업의 Queue에 없던 신규 항목은 완료 후 다시 수집합니다.
        if (!current.running || refreshVersion > 0) {
          const started = await api.items.fillMissingMetadata() as MetadataFillStatus
          if (canceled) return
          const completed = await waitForCompletion(started)
          changed = changed || completed.updated > 0
        }
        if (!canceled && changed) await latestLoadItems.current()
      } catch (e) {
        console.error('Failed to start metadata fill:', e)
      }
    }

    void startBackgroundFill()

    return () => {
      canceled = true
      clearTimeout(timer)
      resume?.()
    }
  }, [enabled, refreshVersion])
}

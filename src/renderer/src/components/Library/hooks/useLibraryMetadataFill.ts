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
}

export function useLibraryMetadataFill({ total, loadItems }: Params) {
  const startedRef = useRef(false)
  const updatedRef = useRef(0)

  useEffect(() => {
    if (startedRef.current || total <= 0) return

    startedRef.current = true
    let canceled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const syncStatus = async (status: MetadataFillStatus) => {
      if (status.updated > updatedRef.current) {
        updatedRef.current = status.updated
        await loadItems()
      }

      if (!status.running && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    }

    const startBackgroundFill = async () => {
      try {
        const initialStatus = await api.items.fillMissingMetadata() as MetadataFillStatus
        if (canceled) return

        await syncStatus(initialStatus)

        if (initialStatus.running) {
          pollTimer = setInterval(async () => {
            try {
              const nextStatus = await api.items.getMetadataFillStatus() as MetadataFillStatus
              if (canceled) return
              await syncStatus(nextStatus)
            } catch (e) {
              console.error('Failed to read metadata fill status:', e)
            }
          }, 2000)
        }
      } catch (e) {
        console.error('Failed to start metadata fill:', e)
      }
    }

    startBackgroundFill()

    return () => {
      canceled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [total, loadItems])
}

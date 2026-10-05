import { useCallback } from 'react'
import { api } from '../../../api'
import type { Item } from '../../../types'
import type { Translate } from '../types'

type Options = {
  tr: Translate
  reloadLibraryData: () => Promise<void>
  showLibraryToast: (message: string, tone: 'success' | 'error') => void
}

export function useLibraryProfileTransfer({ tr, reloadLibraryData, showLibraryToast }: Options) {
  const getMoveErrorMessage = useCallback(
    (reason?: string) => {
      if (reason === 'duplicate-file') return tr('library.context.moveDuplicate')
      if (reason === 'current-profile') return tr('library.context.moveCurrent')
      if (reason === 'missing-profile') return tr('library.context.moveMissingProfile')
      return tr('library.context.moveFailed')
    },
    [tr]
  )

  const handleMoveToProfile = useCallback(
    async (item: Item, targetProfileId: number, targetProfileName: string) => {
      try {
        const result = await api.items.moveToProfile(item.id, targetProfileId)
        if (!result?.ok) {
          showLibraryToast(result?.message || getMoveErrorMessage(result?.reason), 'error')
          return false
        }

        await reloadLibraryData()
        showLibraryToast(tr('library.context.moveDone', { profile: targetProfileName }), 'success')
        return true
      } catch (error: any) {
        showLibraryToast(String(error?.message || error), 'error')
        return false
      }
    },
    [getMoveErrorMessage, reloadLibraryData, showLibraryToast, tr]
  )

  const handleCopyToProfile = useCallback(
    async (item: Item, targetProfileId: number, targetProfileName: string) => {
      try {
        const result = await api.items.copyToProfile(item.id, targetProfileId)
        if (!result?.ok) {
          showLibraryToast(result?.message || getMoveErrorMessage(result?.reason), 'error')
          return false
        }

        showLibraryToast(tr('library.context.copyDone', { profile: targetProfileName }), 'success')
        return true
      } catch (error: any) {
        showLibraryToast(String(error?.message || error), 'error')
        return false
      }
    },
    [getMoveErrorMessage, showLibraryToast, tr]
  )

  return { handleMoveToProfile, handleCopyToProfile }
}

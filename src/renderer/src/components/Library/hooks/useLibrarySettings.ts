import { useCallback, useEffect, useState } from 'react'
import type { LanguageSetting } from '../../../i18n/index'
import { api } from '../../../api'
import type { BulkRelinkConflict, BulkRelinkFailedTarget, Translate } from '../types'

type UseLibrarySettingsOptions = {
  tr: Translate
  changeLanguageSetting: (value: LanguageSetting) => Promise<void>
  loadItems: () => Promise<void>
}

export function useLibrarySettings({ tr, changeLanguageSetting, loadItems }: UseLibrarySettingsOptions) {
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [fileModifiedPolicy, setFileModifiedPolicy] = useState('once')
  const [playlistPosition, setPlaylistPosition] = useState<'left' | 'right'>('right')
  const [bulkFromFolder, setBulkFromFolder] = useState('')
  const [bulkToFolder, setBulkToFolder] = useState('')
  const [bulkMatchCount, setBulkMatchCount] = useState(0)
  const [bulkCounting, setBulkCounting] = useState(false)
  const [bulkRelinking, setBulkRelinking] = useState(false)
  const [bulkRelinkNotice, setBulkRelinkNotice] = useState('')
  const [bulkRelinkConfirmOpen, setBulkRelinkConfirmOpen] = useState(false)
  const [bulkRelinkConflict, setBulkRelinkConflict] = useState<BulkRelinkConflict | null>(null)
  const [bulkRelinkErrorOpen, setBulkRelinkErrorOpen] = useState(false)
  const [bulkRelinkErrorMessage, setBulkRelinkErrorMessage] = useState('')
  const [bulkRelinkFailedTarget, setBulkRelinkFailedTarget] = useState<BulkRelinkFailedTarget | null>(null)

  useEffect(() => {
    api.settings.get('fileModifiedAt.updatePolicy').then((value: string | undefined) => {
      if (value) setFileModifiedPolicy(value)
    })
    api.settings.get('playlist.position').then((value: string | undefined) => {
      if (value === 'left' || value === 'right') setPlaylistPosition(value)
    })
  }, [])

  useEffect(() => {
    let canceled = false

    const loadBulkMatchCount = async () => {
      if (!bulkFromFolder) {
        setBulkMatchCount(0)
        setBulkRelinkNotice('')
        return
      }

      setBulkCounting(true)
      try {
        const count = await api.items.countByFolderPrefix(bulkFromFolder)
        if (canceled) return
        setBulkMatchCount(count)
      } catch {
        if (canceled) return
        setBulkMatchCount(0)
      } finally {
        if (!canceled) setBulkCounting(false)
      }
    }

    loadBulkMatchCount()
    return () => {
      canceled = true
    }
  }, [bulkFromFolder])

  const openSettingsModal = useCallback(() => setSettingsModalOpen(true), [])
  const closeSettingsModal = useCallback(() => setSettingsModalOpen(false), [])

  const handleChangeFileModifiedPolicy = useCallback(async (value: string) => {
    setFileModifiedPolicy(value)
    await api.settings.set('fileModifiedAt.updatePolicy', value)
  }, [])

  const handleChangePlaylistPosition = useCallback(async (value: 'left' | 'right') => {
    setPlaylistPosition(value)
    await api.settings.set('playlist.position', value)
  }, [])

  const handleChangeLanguageSetting = useCallback(async (value: LanguageSetting) => {
    await changeLanguageSetting(value)
  }, [changeLanguageSetting])

  const resetBulkRelinkMessages = useCallback(() => {
    setBulkRelinkNotice('')
    setBulkRelinkConflict(null)
    setBulkRelinkErrorOpen(false)
    setBulkRelinkErrorMessage('')
    setBulkRelinkFailedTarget(null)
  }, [])

  const handlePickBulkFromFolder = useCallback(async () => {
    const picked = await api.file.openFolderDialog()
    if (!picked) return
    setBulkFromFolder(picked)
    resetBulkRelinkMessages()
  }, [resetBulkRelinkMessages])

  const handlePickBulkToFolder = useCallback(async () => {
    const picked = await api.file.openFolderDialog()
    if (!picked) return
    setBulkToFolder(picked)
    resetBulkRelinkMessages()
  }, [resetBulkRelinkMessages])

  const closeBulkRelinkConfirm = useCallback(() => {
    if (bulkRelinking) return
    setBulkRelinkConfirmOpen(false)
  }, [bulkRelinking])

  const handleApplyBulkRelink = useCallback(async () => {
    if (bulkRelinking) return
    setBulkRelinking(true)
    try {
      const result = await api.items.bulkRelinkFolder(bulkFromFolder, bulkToFolder)

      if (result?.ok === false && result?.reason === 'duplicate') {
        setBulkRelinkConfirmOpen(false)
        setBulkRelinkConflict(result.conflict || null)
        return
      }

      if (result?.ok === false) {
        setBulkRelinkConfirmOpen(false)
        setBulkRelinkErrorMessage(String(result?.message || ''))
        setBulkRelinkFailedTarget(result?.failedTarget || null)
        setBulkRelinkErrorOpen(true)
        return
      }

      const updated = Number(result?.updated ?? 0)
      setBulkRelinkNotice(tr('settings.bulkRelink.done', { count: updated }))
      setBulkRelinkConfirmOpen(false)
      await loadItems()
      const latestCount = await api.items.countByFolderPrefix(bulkFromFolder)
      setBulkMatchCount(Number(latestCount ?? 0))
    } catch (error: any) {
      setBulkRelinkConfirmOpen(false)
      setBulkRelinkErrorMessage(String(error?.message || ''))
      setBulkRelinkFailedTarget(null)
      setBulkRelinkErrorOpen(true)
    } finally {
      setBulkRelinking(false)
    }
  }, [bulkFromFolder, bulkRelinking, bulkToFolder, loadItems, tr])

  const closeBulkRelinkError = useCallback(() => {
    setBulkRelinkErrorOpen(false)
    setBulkRelinkErrorMessage('')
    setBulkRelinkFailedTarget(null)
  }, [])

  return {
    settingsModalOpen,
    fileModifiedPolicy,
    playlistPosition,
    bulkFromFolder,
    bulkToFolder,
    bulkMatchCount,
    bulkCounting,
    bulkRelinking,
    bulkRelinkNotice,
    bulkRelinkConfirmOpen,
    bulkRelinkConflict,
    bulkRelinkErrorOpen,
    bulkRelinkErrorMessage,
    bulkRelinkFailedTarget,
    openSettingsModal,
    closeSettingsModal,
    handleChangeLanguageSetting,
    handleChangeFileModifiedPolicy,
    handleChangePlaylistPosition,
    handlePickBulkFromFolder,
    handlePickBulkToFolder,
    openBulkRelinkConfirm: () => setBulkRelinkConfirmOpen(true),
    closeBulkRelinkConfirm,
    closeBulkRelinkConflict: () => setBulkRelinkConflict(null),
    closeBulkRelinkError,
    handleApplyBulkRelink,
  }
}

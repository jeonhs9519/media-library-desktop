import { useCallback, useEffect, useState } from 'react'
import type { LanguageSetting } from '../../../i18n/index'
import { api } from '../../../api'
import type { BulkRelinkConflict, BulkRelinkFailedTarget, LegacyDatabasePreview, Translate } from '../types'

type UseLibrarySettingsOptions = {
  tr: Translate
  changeLanguageSetting: (value: LanguageSetting) => Promise<void>
  loadItems: () => Promise<void>
}

type ProfileSummary = {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

type ProfileStatus = {
  currentProfileId: number | null
  profiles: ProfileSummary[]
  unassignedCounts: {
    items: number
    tags: number
    playlists: number
    settings: number
  }
}

type ProfileToast = {
  id: number
  message: string
  tone: 'success' | 'error'
}

function getProfileErrorMessage(tr: Translate, reason?: string) {
  if (reason === 'empty-name') return tr('settings.profile.errorEmpty')
  if (reason === 'name-too-long') return tr('settings.profile.errorTooLong')
  if (reason === 'reserved-name') return tr('settings.profile.errorReserved')
  if (reason === 'duplicate-name') return tr('settings.profile.errorDuplicate')
  if (reason === 'transfer-failed') return tr('settings.profile.errorTransfer')
  return tr('settings.profile.errorDefault')
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
  const [legacyDbPath, setLegacyDbPath] = useState('')
  const [legacyDbNotice, setLegacyDbNotice] = useState('')
  const [legacyDbPreviewOpen, setLegacyDbPreviewOpen] = useState(false)
  const [legacyDbPreview, setLegacyDbPreview] = useState<LegacyDatabasePreview | null>(null)
  const [legacyDbPreviewing, setLegacyDbPreviewing] = useState(false)
  const [legacyDbImporting, setLegacyDbImporting] = useState(false)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null)
  const [profileNameDraft, setProfileNameDraft] = useState('')
  const [profileNotice, setProfileNotice] = useState<ProfileToast | null>(null)
  const [profileToastClosing, setProfileToastClosing] = useState(false)
  const [profileNameErrorActive, setProfileNameErrorActive] = useState(false)
  const [profileNameFocusSignal, setProfileNameFocusSignal] = useState(0)
  const [profileBusy, setProfileBusy] = useState(false)

  useEffect(() => {
    api.settings.get('fileModifiedAt.updatePolicy').then((value: string | undefined) => {
      if (value) setFileModifiedPolicy(value)
    })
    api.settings.get('playlist.position').then((value: string | undefined) => {
      if (value === 'left' || value === 'right') setPlaylistPosition(value)
    })
  }, [])

  const syncProfileStatus = useCallback(async () => {
    const status = await api.profiles.getStatus() as ProfileStatus
    setProfileStatus(status)
    const current = status.profiles.find((profile) => profile.id === status.currentProfileId)
    setProfileNameDraft(current?.name || '')
    return status
  }, [])

  useEffect(() => {
    syncProfileStatus().catch(console.error)
  }, [syncProfileStatus])

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

  const showProfileToast = useCallback((message: string, tone: 'success' | 'error') => {
    setProfileToastClosing(false)
    setProfileNotice((current) => ({ id: (current?.id ?? 0) + 1, message, tone }))

    if (tone === 'error') {
      setProfileNameErrorActive(true)
      setProfileNameFocusSignal((current) => current + 1)
    }
  }, [])

  useEffect(() => {
    if (!profileNotice) return
    const timeoutId = window.setTimeout(() => setProfileToastClosing(true), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNotice])

  useEffect(() => {
    if (!profileNotice || !profileToastClosing) return
    const timeoutId = window.setTimeout(() => setProfileNotice(null), 160)
    return () => window.clearTimeout(timeoutId)
  }, [profileNotice, profileToastClosing])

  useEffect(() => {
    if (!profileNameErrorActive) return
    const timeoutId = window.setTimeout(() => setProfileNameErrorActive(false), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameErrorActive])

  const handleRenameProfile = useCallback(async () => {
    if (!profileStatus?.currentProfileId || profileBusy) return
    setProfileBusy(true)
    setProfileNotice(null)
    setProfileToastClosing(false)
    try {
      const result = await api.profiles.rename(profileStatus.currentProfileId, profileNameDraft)
      setProfileStatus(result?.status || profileStatus)
      if (!result?.ok) {
        showProfileToast(result?.message || getProfileErrorMessage(tr, result?.reason), 'error')
        return
      }
      await syncProfileStatus()
      showProfileToast(tr('settings.profile.renameDone'), 'success')
    } catch (error: any) {
      showProfileToast(String(error?.message || ''), 'error')
    } finally {
      setProfileBusy(false)
    }
  }, [profileBusy, profileNameDraft, profileStatus, showProfileToast, syncProfileStatus, tr])

  const handleOpenProfileSelection = useCallback(async () => {
    if (profileBusy) return
    setProfileBusy(true)
    setProfileNotice(null)
    setProfileToastClosing(false)
    try {
      await api.profiles.clearSelection()
      await api.app.reload()
    } catch (error: any) {
      showProfileToast(String(error?.message || ''), 'error')
    } finally {
      setProfileBusy(false)
    }
  }, [profileBusy, showProfileToast])

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

  const handleSelectLegacyDbFile = useCallback((file: File | null) => {
    if (!file) {
      setLegacyDbPath('')
      setLegacyDbNotice('')
      return
    }

    const nextPath = api.file.getPathForFile(file)
    setLegacyDbPath(nextPath)
    setLegacyDbNotice(nextPath ? '' : tr('settings.legacyDb.pathBlocked'))
  }, [tr])

  const handlePreviewLegacyDbImport = useCallback(async () => {
    if (!legacyDbPath || legacyDbPreviewing) return

    setLegacyDbPreviewing(true)
    setLegacyDbNotice('')
    try {
      const preview = await api.legacyDatabase.preview(legacyDbPath) as LegacyDatabasePreview
      setLegacyDbPreview(preview)
      setLegacyDbPreviewOpen(true)
    } catch (error: any) {
      setLegacyDbNotice(String(error?.message || ''))
    } finally {
      setLegacyDbPreviewing(false)
    }
  }, [legacyDbPath, legacyDbPreviewing])

  const closeLegacyDbPreview = useCallback(() => {
    if (legacyDbImporting) return
    setLegacyDbPreviewOpen(false)
  }, [legacyDbImporting])

  const handleApplyLegacyDbImport = useCallback(async () => {
    if (!legacyDbPath || legacyDbImporting) return

    setLegacyDbImporting(true)
    try {
      const result = await api.legacyDatabase.import(legacyDbPath)
      if (result?.ok === false) {
        setLegacyDbNotice(String(result?.message || ''))
        return
      }

      setLegacyDbNotice(tr('settings.legacyDb.done', {
        imported: Number(result?.imported ?? 0),
        skipped: Number(result?.skipped ?? 0),
      }))
      setLegacyDbPreviewOpen(false)
      setLegacyDbPreview(null)
      await loadItems()
    } catch (error: any) {
      setLegacyDbNotice(String(error?.message || ''))
    } finally {
      setLegacyDbImporting(false)
    }
  }, [legacyDbImporting, legacyDbPath, loadItems, tr])

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
    legacyDbPath,
    legacyDbNotice,
    legacyDbPreviewOpen,
    legacyDbPreview,
    legacyDbPreviewing,
    legacyDbImporting,
    profileStatus,
    profileNameDraft,
    profileNotice,
    profileToastClosing,
    profileNameErrorActive,
    profileNameFocusSignal,
    profileBusy,
    openSettingsModal,
    closeSettingsModal,
    setProfileNameDraft,
    handleRenameProfile,
    handleOpenProfileSelection,
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
    handleSelectLegacyDbFile,
    handlePreviewLegacyDbImport,
    closeLegacyDbPreview,
    handleApplyLegacyDbImport,
  }
}

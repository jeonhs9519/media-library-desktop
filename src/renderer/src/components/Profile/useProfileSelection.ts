import { useState, useEffect, useRef } from 'react'
import { api } from '../../api'
import type { ProfileStatus, ProfileSummary, ProfileDeleteSummary } from '../../types/profile'

function getProfileErrorMessage(reason?: string) {
  if (reason === 'empty-name') return '프로필명을 입력해주세요.'
  if (reason === 'name-too-long') return '프로필명은 16자 이하로 입력해주세요.'
  if (reason === 'reserved-name') return '사용할 수 없는 프로필명입니다.'
  if (reason === 'duplicate-name') return '이미 존재하는 프로필명입니다.'
  if (reason === 'transfer-failed') return '기존 데이터 이관 중 오류가 발생했습니다.'
  return '프로필을 선택하지 못했습니다.'
}

export function useProfileSelection() {
  const [status, setStatus] = useState<ProfileStatus | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [profileName, setProfileName] = useState('')
  const [useProfileOnNextStartup, setUseProfileOnNextStartup] = useState(false)
  const [profileNameToast, setProfileNameToast] = useState<{ id: number; message: string } | null>(
    null
  )
  const [profileNameToastClosing, setProfileNameToastClosing] = useState(false)
  const [profileNameErrorActive, setProfileNameErrorActive] = useState(false)
  const [profileNameFocusSignal, setProfileNameFocusSignal] = useState(0)
  const [deleteSummary, setDeleteSummary] = useState<ProfileDeleteSummary | null>(null)
  const [deleteMode, setDeleteMode] = useState<'transfer' | 'delete'>('transfer')
  const [deleteTargetProfileId, setDeleteTargetProfileId] = useState<number | null>(null)
  const [deleteDuplicateStrategy, setDeleteDuplicateStrategy] = useState<'target' | 'source'>(
    'target'
  )
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const profileNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let mounted = true

    api.profiles
      .getStatus()
      .then((nextStatus: ProfileStatus) => {
        if (!mounted) return
        setStatus(nextStatus)
        const initialProfileId =
          nextStatus.currentProfileId ||
          nextStatus.lastActiveProfileId ||
          nextStatus.profiles[0]?.id ||
          null
        setSelectedProfileId(initialProfileId)
        setUseProfileOnNextStartup(Boolean(nextStatus.useLastProfileOnStartup))
      })
      .catch((err: unknown) => {
        if (mounted) setError(String((err as Error)?.message || err))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!profileNameToast) return
    const timeoutId = window.setTimeout(() => setProfileNameToastClosing(true), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameToast])

  useEffect(() => {
    if (!profileNameToast || !profileNameToastClosing) return
    const timeoutId = window.setTimeout(() => setProfileNameToast(null), 160)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameToast, profileNameToastClosing])

  useEffect(() => {
    if (!profileNameErrorActive) return
    const timeoutId = window.setTimeout(() => setProfileNameErrorActive(false), 2400)
    return () => window.clearTimeout(timeoutId)
  }, [profileNameErrorActive])

  useEffect(() => {
    if (!profileNameFocusSignal) return
    profileNameInputRef.current?.focus()
    profileNameInputRef.current?.select()
  }, [profileNameFocusSignal])

  const showProfileNameError = (message: string) => {
    setProfileNameToastClosing(false)
    setProfileNameToast((current) => ({ id: (current?.id ?? 0) + 1, message }))
    setProfileNameErrorActive(true)
    setProfileNameFocusSignal((current) => current + 1)
  }

  const selectProfile = async (profileId: number) => {
    setSubmitting(true)
    setError('')
    try {
      const result = await api.profiles.select(profileId, useProfileOnNextStartup)
      if (!result?.ok) {
        setStatus(result?.status || status)
        setError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }
      setStatus(result.status)
    } catch (err: unknown) {
      setError(String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const startWithSelection = async () => {
    if (profileName.trim()) {
      await createAndSelectProfile()
      return
    }

    if (selectedProfileId) {
      await selectProfile(selectedProfileId)
    }
  }

  const createAndSelectProfile = async () => {
    setSubmitting(true)
    setError('')
    setProfileNameToast(null)
    setProfileNameToastClosing(false)
    try {
      const result = await api.profiles.createAndSelect(profileName, useProfileOnNextStartup)
      if (!result?.ok) {
        setStatus(result?.status || status)
        showProfileNameError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }
      setProfileName('')
      setStatus(result.status)
    } catch (err: unknown) {
      showProfileNameError(String((err as Error)?.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const openDeleteProfileModal = async (profile: ProfileSummary) => {
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const result = (await api.profiles.getDeleteSummary(profile.id)) as ProfileDeleteSummary
      if (!result?.ok) {
        setStatus(result?.status || status)
        setError(getProfileErrorMessage(result?.reason))
        return
      }

      setDeleteSummary(result)
      setDeleteMode(result.itemCount > 0 ? 'transfer' : 'delete')
      setDeleteTargetProfileId(result.targets[0]?.id ?? null)
      setDeleteDuplicateStrategy('target')
      setDeleteConfirmed(false)
    } catch (err: unknown) {
      setError(String((err as Error)?.message || err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const closeDeleteProfileModal = () => {
    if (deleteBusy) return
    setDeleteSummary(null)
    setDeleteError('')
  }

  const deleteProfile = async () => {
    if (!deleteSummary?.profile) return

    setDeleteBusy(true)
    setDeleteError('')
    try {
      const result = await api.profiles.delete(
        deleteSummary.profile.id,
        deleteMode,
        deleteMode === 'transfer' ? (deleteTargetProfileId ?? undefined) : undefined,
        deleteMode === 'transfer' ? deleteDuplicateStrategy : undefined
      )

      if (!result?.ok) {
        setStatus(result?.status || status)
        setDeleteError(result?.message || getProfileErrorMessage(result?.reason))
        return
      }

      const nextStatus = result.status as ProfileStatus
      setStatus(nextStatus)
      setSelectedProfileId(
        nextStatus.currentProfileId ||
          nextStatus.lastActiveProfileId ||
          nextStatus.profiles[0]?.id ||
          null
      )
      setDeleteSummary(null)
    } catch (err: unknown) {
      setDeleteError(String((err as Error)?.message || err))
    } finally {
      setDeleteBusy(false)
    }
  }

  const deleteRequiresConfirmation = Boolean(deleteSummary && deleteSummary.itemCount > 0)
  const canDeleteProfile =
    Boolean(deleteSummary?.profile) &&
    !deleteBusy &&
    (!deleteRequiresConfirmation || deleteConfirmed) &&
    (deleteMode !== 'transfer' || Boolean(deleteTargetProfileId))

  return {
    status,
    selectedProfileId,
    setSelectedProfileId,
    profileName,
    setProfileName,
    useProfileOnNextStartup,
    setUseProfileOnNextStartup,
    profileNameInputRef,
    profileNameToast,
    profileNameToastClosing,
    profileNameErrorActive,
    loading,
    submitting,
    error,
    selectProfile,
    startWithSelection,
    createAndSelectProfile,
    openDeleteProfileModal,
    closeDeleteProfileModal,
    deleteProfile,
    deleteSummary,
    deleteMode,
    setDeleteMode,
    deleteTargetProfileId,
    setDeleteTargetProfileId,
    deleteDuplicateStrategy,
    setDeleteDuplicateStrategy,
    deleteConfirmed,
    setDeleteConfirmed,
    deleteBusy,
    deleteError,
    canDeleteProfile,
  }
}

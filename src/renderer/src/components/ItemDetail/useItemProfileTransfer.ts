import { useState, useEffect } from 'react'
import type { Item } from '../../types'
import { api } from '../../api'
import type { Translate } from '../../i18n'
import type { ItemDetailPageProps, ProfileMoveTarget } from './types'

type Options = Pick<
  ItemDetailPageProps,
  'itemId' | 'onClose' | 'onMoveToProfile' | 'onCopyToProfile'
> & { item: Item | null; tr: Translate }

export function useItemProfileTransfer({
  itemId,
  item,
  onClose,
  onMoveToProfile,
  onCopyToProfile,
  tr,
}: Options) {
  const [profileMoveTargets, setProfileMoveTargets] = useState<ProfileMoveTarget[]>([])
  const [profileMoveTargetsLoading, setProfileMoveTargetsLoading] = useState(false)
  const [profileTransferTargetId, setProfileTransferTargetId] = useState<number | null>(null)
  const [profileTransferBusy, setProfileTransferBusy] = useState(false)
  const loadProfileMoveTargets = async () => {
    setProfileMoveTargetsLoading(true)
    try {
      const result = await api.items.getMoveTargets(itemId)
      const targets = result?.ok ? result.targets || [] : []
      setProfileMoveTargets(targets)
      setProfileTransferTargetId((current) => {
        if (
          current &&
          targets.some((target: ProfileMoveTarget) => target.id === current && !target.disabled)
        ) {
          return current
        }
        return targets.find((target: ProfileMoveTarget) => !target.disabled)?.id ?? null
      })
    } finally {
      setProfileMoveTargetsLoading(false)
    }
  }

  useEffect(() => {
    loadProfileMoveTargets()
  }, [itemId])

  const selectedProfileTransferTarget = profileMoveTargets.find(
    (target) => target.id === profileTransferTargetId
  )

  const getProfileTransferOptionLabel = (target: ProfileMoveTarget) => {
    if (target.reason === 'duplicate-file')
      return `${target.name} - ${tr('library.context.moveDuplicate')}`
    if (target.reason === 'current-profile')
      return `${target.name} - ${tr('library.context.moveCurrent')}`
    return target.name
  }

  const handleProfileMove = async () => {
    if (
      !item ||
      !selectedProfileTransferTarget ||
      selectedProfileTransferTarget.disabled ||
      !onMoveToProfile
    )
      return

    setProfileTransferBusy(true)
    try {
      const ok = await onMoveToProfile(
        item,
        selectedProfileTransferTarget.id,
        selectedProfileTransferTarget.name
      )
      if (ok) onClose()
    } finally {
      setProfileTransferBusy(false)
    }
  }

  const handleProfileCopy = async () => {
    if (
      !item ||
      !selectedProfileTransferTarget ||
      selectedProfileTransferTarget.disabled ||
      !onCopyToProfile
    )
      return

    setProfileTransferBusy(true)
    try {
      const ok = await onCopyToProfile(
        item,
        selectedProfileTransferTarget.id,
        selectedProfileTransferTarget.name
      )
      if (ok) await loadProfileMoveTargets()
    } finally {
      setProfileTransferBusy(false)
    }
  }

  const canUseProfileTransfer = Boolean(
    selectedProfileTransferTarget && !selectedProfileTransferTarget.disabled
  )

  return {
    profileMoveTargets,
    profileMoveTargetsLoading,
    profileTransferTargetId,
    setProfileTransferTargetId,
    profileTransferBusy,
    getProfileTransferOptionLabel,
    handleProfileMove,
    handleProfileCopy,
    canUseProfileTransfer,
  }
}

import { GUEST_PROFILE_ID } from '../db/schema'

let activeProfileId: number | null = null

export function getActiveProfileId() {
  return activeProfileId ?? GUEST_PROFILE_ID
}

export function setActiveProfileId(profileId: number) {
  activeProfileId = profileId
}

export function clearActiveProfileId() {
  activeProfileId = null
}

export function hasActiveProfile() {
  return activeProfileId !== null
}

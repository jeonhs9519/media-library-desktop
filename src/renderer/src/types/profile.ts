export type ProfileSummary = {
  id: number
  name: string
  createdAt: number
  updatedAt: number
}

export type ProfileStatus = {
  currentProfileId: number | null
  profiles: ProfileSummary[]
  lastActiveProfileId: number | null
  useLastProfileOnStartup: boolean
  unassignedCounts: {
    items: number
    tags: number
    playlists: number
    settings: number
  }
}

export type ProfileDeleteSummary = {
  ok: boolean
  reason?: string
  profile?: ProfileSummary
  itemCount: number
  targets: Array<{ id: number; name: string }>
  status?: ProfileStatus
}

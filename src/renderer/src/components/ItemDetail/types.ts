import type { Item, Tag } from '../../types'

export interface ItemDetailPageProps {
  itemId: number
  onClose: () => void
  onAddToPlaylist?: (item: Item) => void
  onMoveToProfile?: (
    item: Item,
    targetProfileId: number,
    targetProfileName: string
  ) => Promise<boolean>
  onCopyToProfile?: (
    item: Item,
    targetProfileId: number,
    targetProfileName: string
  ) => Promise<boolean>
}

export type ProfileMoveTarget = {
  id: number
  name: string
  disabled: boolean
  reason?: string | null
}

export type UsedTag = Tag & {
  count: number
}

export type ItemEditForm = {
  title: string
  contentType: Item['contentType']
  language: string
  author: string
  memo: string
  sourceUrl: string
  watched: boolean
}

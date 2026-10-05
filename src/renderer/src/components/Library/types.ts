export type { Translate } from '../../i18n'

export type TagUsageCount = {
  id: number
  name: string
  count: number
}

export type HdtPreviewItem = {
  previewId: string
  sourceFile: string
  title: string
  sourceUrl?: string
  author?: string
  filePath: string
  fileName: string
  fileExtension: string
  contentType: 'book' | 'comic' | 'video' | 'other'
  duplicate: boolean
  hasThumbnail: boolean
  thumbnailBase64?: string
  disabledReason?: 'missing_title' | 'missing_path' | 'invalid_entry' | 'duplicate'
}

export type HdtPreviewStats = {
  rawTotal: number
  visibleTotal: number
  selectableTotal: number
}

export type HdtPreviewResponse = {
  items: HdtPreviewItem[]
  stats: HdtPreviewStats
}

export type LegacyDatabasePreviewItem = {
  profileName?: string
  previewId: string
  legacyId: number
  title: string
  filePath: string
  fileName: string
  fileExtension: string
  contentType: string
  watched: number
  progress: number
  hasThumbnail: boolean
  tagNames: string[]
  reviewRating?: number
  hasReview: boolean
  duplicate: boolean
  disabledReason?: 'duplicate' | 'invalid_entry'
}

export type LegacyDatabasePreviewSetting = {
  profileName?: string
  key: string
  value: string
  exists: boolean
}

export type LegacyDatabasePreviewTag = {
  profileName?: string
  id: number
  name: string
  exists: boolean
}

export type LegacyDatabasePreview = {
  profiles?: Array<{ id: number; name: string; exists: boolean }>
  ok: boolean
  filePath?: string
  message?: string
  settings: LegacyDatabasePreviewSetting[]
  tags: LegacyDatabasePreviewTag[]
  items: LegacyDatabasePreviewItem[]
  stats: {
    sourceItemCount: number
    importableItemCount: number
    duplicateItemCount: number
    invalidItemCount: number
    tagCount: number
    reviewCount: number
    playlistCount: number
    playlistItemCount: number
  }
}

export type BulkRelinkConflict = {
  movingTitle?: string
  movingPath: string
  targetPath: string
  existingTitle?: string
  existingPath: string
}

export type BulkRelinkFailedTarget = {
  movingTitle?: string
  movingPath: string
  targetPath: string
}

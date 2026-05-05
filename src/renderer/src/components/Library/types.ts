export type Translate = (key: string, params?: Record<string, string | number>) => string

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
  contentType: 'comic' | 'video'
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
  key: string
  value: string
  exists: boolean
}

export type LegacyDatabasePreviewTag = {
  id: number
  name: string
  exists: boolean
}

export type LegacyDatabasePreview = {
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

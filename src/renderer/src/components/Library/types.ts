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

export interface Item {
  id: number
  filePath: string
  fileName: string
  fileExtension: string
  title: string
  sourceUrl?: string | null
  author?: string | null
  memo?: string | null
  contentType: 'book' | 'comic' | 'video' | 'other'
  containerType: 'pdf' | 'zip' | 'video' | 'other'
  language: string
  watched: number
  progress: number
  lastPageIndex?: number | null
  lastPositionSeconds?: number | null
  totalContent?: number | null // Pages for book/comic, seconds for video
  thumbnail?: Buffer | null
  thumbnailBase64?: string | null
  createdAt: number
  updatedAt: number
  fileModifiedAt?: number | null
  tags?: Tag[]
  review?: Review | null
  fileExists?: boolean
}

export interface Tag {
  id: number
  name: string
}

export interface Review {
  id: number
  itemId: number
  rating: number
  comment?: string | null
  createdAt: number
  updatedAt: number
}

export interface PlaylistItem {
  playlistId: number
  itemId: number
  position: number
  createdAt: number
  item: Item
}

export type SortField = 'title' | 'createdAt' | 'updatedAt' | 'fileModifiedAt' | 'rating'
export type SortDir = 'asc' | 'desc'
export type ContentType = 'book' | 'comic' | 'video' | 'other'
export type Language = 'ko' | 'ja' | 'en' | 'zh' | 'other' | ''

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
  thumbnail?: Buffer | null
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

export type SortField = 'title' | 'createdAt' | 'updatedAt' | 'fileModifiedAt' | 'rating'
export type SortDir = 'asc' | 'desc'
export type ContentType = 'book' | 'comic' | 'video' | 'other'
export type Language = 'ko' | 'ja' | 'en' | 'zh' | 'other' | ''

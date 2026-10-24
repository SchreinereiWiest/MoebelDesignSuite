export type ImageStatus =
  | 'PENDING_UPLOAD'
  | 'QUEUED'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED'

export type ImageVisibility = 'PRIVATE' | 'RESTRICTED' | 'PUBLIC'

export type TagCategory =
  | 'ROOM'
  | 'FURNITURE'
  | 'MATERIAL'
  | 'COLOR'
  | 'STYLE'
  | 'FEATURE'
  | 'TECHNICAL'

export type DesignTag = {
  id?: string
  name: string
  slug: string
  category: TagCategory
  imageCount?: number
}

export type ImageSummary = {
  id: string
  filename: string
  title: string | null
  description: string | null
  mimeType: string
  byteSize: string | null
  width: number | null
  height: number | null
  status: ImageStatus
  visibility: ImageVisibility
  createdAt: string
  tags: DesignTag[]
  thumbnailUrl: string | null
}

export type ImageDetail = ImageSummary & {
  updatedAt: string
  metadata: Record<string, unknown> | null
  imageUrl: string
}

export type ImageListResponse = {
  data: ImageSummary[]
  page: number
  limit: number
  total: number
}

export type CollectionSummary = {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  itemCount: number
  covers: Array<{ imageId: string; url: string | null }>
}

export type MoodboardItem = {
  id: string
  imageId: string
  sortOrder: number
  x: number | null
  y: number | null
  width: number | null
  height: number | null
  rotation: number
  zIndex: number
  note: string | null
  rating: 'LIKE' | 'DISLIKE' | null
  image: {
    id: string
    title: string | null
    filename: string
    visibility: ImageVisibility
    status: ImageStatus
    tags: DesignTag[]
    url: string
    thumbnailUrl: string | null
  }
}

export type CollectionDetail = {
  id: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  items: MoodboardItem[]
}

export type CollectionListResponse = {
  data: CollectionSummary[]
  page: number
  limit: number
  total: number
}

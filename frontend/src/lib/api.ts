import type {
  CollectionDetail,
  CollectionListResponse,
  DesignTag,
  ImageDetail,
  ImageListResponse,
  ImageVisibility,
  MoodboardItem,
  TagCategory,
} from '@/types'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(payload?.error || `Anfrage fehlgeschlagen (${response.status})`, response.status)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function listImages(input: {
  page?: number
  limit?: number
  search?: string
  tags?: string[]
  match?: 'all' | 'any'
  visibility?: ImageVisibility
  status?: string
} = {}) {
  const query = new URLSearchParams()
  if (input.page) query.set('page', String(input.page))
  if (input.limit) query.set('limit', String(input.limit))
  if (input.search) query.set('search', input.search)
  if (input.tags?.length) query.set('tags', input.tags.join(','))
  if (input.match) query.set('match', input.match)
  if (input.visibility) query.set('visibility', input.visibility)
  if (input.status) query.set('status', input.status)
  return request<ImageListResponse>(`/images?${query.toString()}`)
}

export function getImage(id: string) {
  return request<ImageDetail>(`/images/${id}`)
}

export function updateImage(
  id: string,
  input: {
    title?: string | null
    description?: string | null
    visibility?: ImageVisibility
    tags?: Array<{ name: string; category: TagCategory }>
  },
) {
  return request<{ id: string; updated: boolean }>(`/images/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteImage(id: string) {
  return request<void>(`/images/${id}`, { method: 'DELETE' })
}

export async function uploadImage(
  file: File,
  metadata: {
    title?: string
    description?: string
    visibility: ImageVisibility
    tags: Array<{ name: string; category: Exclude<TagCategory, 'TECHNICAL'> }>
  },
  onProgress?: (progress: number) => void,
) {
  const presigned = await request<{
    imageId: string
    uploadUrl: string
    headers: Record<string, string>
  }>('/images/presign', {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      ...metadata,
    }),
  })

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', presigned.uploadUrl)
    Object.entries(presigned.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new Error('Der Upload zum Bildspeicher ist fehlgeschlagen.'))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Der Bildspeicher antwortet mit Status ${xhr.status}.`))
    }
    xhr.send(file)
  })

  onProgress?.(100)
  return request<{ imageId: string; status: string }>(`/images/${presigned.imageId}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function listTags() {
  const response = await request<{ data: DesignTag[] }>('/tags')
  return response.data
}

export function listCollections(input: { page?: number; limit?: number; search?: string } = {}) {
  const query = new URLSearchParams()
  if (input.page) query.set('page', String(input.page))
  if (input.limit) query.set('limit', String(input.limit))
  if (input.search) query.set('search', input.search)
  return request<CollectionListResponse>(`/collections?${query.toString()}`)
}

export function createCollection(input: { name: string; description?: string }) {
  return request<{ id: string; name: string; description: string | null }>('/collections', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function getCollection(id: string) {
  return request<CollectionDetail>(`/collections/${id}`)
}

export function updateCollection(id: string, input: { name?: string; description?: string | null }) {
  return request<{ id: string; name: string; description: string | null }>(`/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteCollection(id: string) {
  return request<void>(`/collections/${id}`, { method: 'DELETE' })
}

export function addCollectionItem(collectionId: string, imageId: string) {
  return request<{ id: string }>(`/collections/${collectionId}/items`, {
    method: 'POST',
    body: JSON.stringify({ imageId }),
  })
}

export function updateCollectionItem(
  collectionId: string,
  itemId: string,
  input: Partial<
    Pick<
      MoodboardItem,
      'sortOrder' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'note' | 'rating'
    >
  >,
) {
  return request<{ id: string }>(`/collections/${collectionId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function removeCollectionItem(collectionId: string, itemId: string) {
  return request<void>(`/collections/${collectionId}/items/${itemId}`, { method: 'DELETE' })
}

import type {
  CollectionDetail,
  CollectionListResponse,
  DesignTag,
  ImageDetail,
  ImageListResponse,
  ImageVisibility,
  MoodboardItem,
  TagCategory,
  AuthSession,
  SuiteLicense,
  TenantSettings,
  TagProposal,
  TagSuggestion,
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

export type BackupImportResult = {
  imported: number
  skippedDuplicates: number
  missingTagLinks: number
  total: number
  sourceTenant: { id: string; name: string }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || 'GET').toUpperCase()
  const csrfToken = document.cookie
    .split('; ')
    .find((value) => value.startsWith('MDS-XSRF-TOKEN='))
    ?.split('=')
    .slice(1)
    .join('=')
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken
        ? { 'x-xsrf-token': decodeURIComponent(csrfToken) }
        : {}),
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

export function loginCompany(input: { company: string; login: string; password: string }) {
  return request<AuthSession>('/auth/login', { method: 'POST', body: JSON.stringify(input) })
}

export function getCurrentSession() {
  return request<AuthSession>('/auth/me')
}

export function logout() {
  return request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({}) })
}

export function getLoginMode() {
  return request<{ mode: 'company' | 'public' }>('/auth/mode')
}

export function exchangePublicKey(key: string) {
  return request<{ mode: 'public' }>('/auth/public-mode', { method: 'POST', body: JSON.stringify({ key }) })
}

export function loginPublic(input: { email: string; password: string }) {
  return request<AuthSession>('/auth/public-login', { method: 'POST', body: JSON.stringify(input) })
}

export function getLicense(refresh = false) {
  return request<{ license: SuiteLicense }>(`/license/current${refresh ? '?refresh=true' : ''}`)
}

export function activateLicense(licenseKey: string) {
  return request<{ license: SuiteLicense }>('/license/current', {
    method: 'PUT',
    body: JSON.stringify({ licenseKey }),
  })
}

export function getTenantSettings() {
  return request<TenantSettings>('/settings/tenant')
}

export function updateTenantSettings(input: Pick<TenantSettings, 'libraryDensity' | 'defaultVisibility' | 'showExternalImages'>) {
  return request<TenantSettings>('/settings/tenant', { method: 'PUT', body: JSON.stringify(input) })
}

export function getSettingsOverview() {
  return request<{ images: number; sharedImages: number; tags: number; pendingTags: number }>('/settings/overview')
}

export function getImageBackupExportUrl() {
  return `${apiBaseUrl}/backups/export`
}

export function importImageBackup(
  file: File,
  onProgress?: (progress: number) => void,
) {
  return new Promise<BackupImportResult>((resolve, reject) => {
    const csrfToken = document.cookie
      .split('; ')
      .find((value) => value.startsWith('MDS-XSRF-TOKEN='))
      ?.split('=')
      .slice(1)
      .join('=')
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${apiBaseUrl}/backups/import`)
    xhr.withCredentials = true
    xhr.setRequestHeader('content-type', 'application/zip')
    if (csrfToken) xhr.setRequestHeader('x-xsrf-token', decodeURIComponent(csrfToken))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onerror = () => reject(new Error('Das Backup konnte nicht übertragen werden.'))
    xhr.onload = () => {
      const payload = (() => {
        try { return JSON.parse(xhr.responseText) as BackupImportResult & { error?: string } }
        catch { return null }
      })()
      if (xhr.status >= 200 && xhr.status < 300 && payload) {
        onProgress?.(100)
        resolve(payload)
      } else {
        reject(new ApiError(payload?.error || `Backup-Import fehlgeschlagen (${xhr.status})`, xhr.status))
      }
    }
    xhr.send(file)
  })
}

export function getTagSuggestions(search: string, category?: TagCategory) {
  const query = new URLSearchParams({ search })
  if (category) query.set('category', category)
  return request<{ data: TagSuggestion[] }>(`/tags/suggestions?${query}`)
}

export function getTagProposals() {
  return request<{ data: TagProposal[] }>('/tags/proposals')
}

export function proposeTag(input: { name: string; category: TagCategory }) {
  return request<{ proposal: TagProposal; suggestions: TagSuggestion[] }>('/tags/proposals', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function resolveTagProposal(
  id: string,
  input:
    | { action: 'approve'; decisionNote?: string }
    | { action: 'reject'; decisionNote: string }
    | { action: 'merge'; targetTagId: string; decisionNote?: string },
) {
  return request<TagProposal>(`/tags/proposals/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
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
    rightsConfirmed?: boolean
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
    rightsConfirmed: boolean
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

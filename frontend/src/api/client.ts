// An empty base uses same-origin /api routes in production deployments.
// Vite proxies these routes to the local backend during development.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const HARD_MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024
const configuredDownloadMax = Number(import.meta.env.VITE_DOWNLOAD_MAX_BYTES)
const MAX_DOWNLOAD_BYTES = Number.isSafeInteger(configuredDownloadMax)
    && configuredDownloadMax > 0
    && configuredDownloadMax <= HARD_MAX_DOWNLOAD_BYTES
  ? configuredDownloadMax
  : HARD_MAX_DOWNLOAD_BYTES

export interface HealthResponse {
  status: string
  service: string
}

export interface ReelValidationResponse {
  valid: boolean
  platform: string
  type: string | null
  message: string
}

export type MediaStatus = 'READY' | 'PROCESSING' | 'UNAVAILABLE' | 'ERROR'

export interface MediaResult {
  status: MediaStatus
  mediaUrl?: string
  thumbnailUrl?: string
  providerReference?: string
  filename?: string
  contentType?: string
  fileSizeBytes?: number
  expiresAt?: string
  message?: string
}

export class ApiError extends Error {
  constructor(readonly status: number | null) {
    super(status === null ? 'The API request failed.' : `The API request failed (${status}).`)
    this.name = 'ApiError'
  }
}

const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: 'Please enter a valid Instagram Reel URL.',
  401: 'This request is not authorized.',
  403: 'This request is not allowed.',
  404: 'The download service could not be found. Please try again later.',
  409: 'This link cannot be checked right now. Please try again.',
  413: 'This video is too large to download through ReelSave.',
  429: "You're making requests too quickly. Please wait a moment and try again.",
  500: 'Something went wrong on our side. Please try again.',
  503: 'The download service is temporarily unavailable. Please try again later.',
}

export function normalizeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === null) {
      return "We couldn't connect to the download service. Please check your connection and try again."
    }
    const statusMessage = HTTP_ERROR_MESSAGES[error.status]
    if (statusMessage) {
      return statusMessage
    }
    if (error.status >= 500) {
      return HTTP_ERROR_MESSAGES[500]!
    }
    return 'We could not check this link. Please try again.'
  }

  return "We couldn't connect to the download service. Please check your connection and try again."
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status)
  }
}

function isValidationResponse(value: unknown): value is ReelValidationResponse {
  if (typeof value !== 'object' || value === null) return false
  const response = value as Partial<ReelValidationResponse>
  return typeof response.valid === 'boolean'
    && typeof response.platform === 'string'
    && (typeof response.type === 'string' || response.type === null)
    && typeof response.message === 'string'
}

function isMediaResult(value: unknown): value is MediaResult {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Partial<MediaResult>
  return (result.status === 'READY'
      || result.status === 'PROCESSING'
      || result.status === 'UNAVAILABLE'
      || result.status === 'ERROR')
    && (result.mediaUrl === undefined || typeof result.mediaUrl === 'string')
    && (result.thumbnailUrl === undefined || typeof result.thumbnailUrl === 'string')
    && (result.providerReference === undefined || typeof result.providerReference === 'string')
    && (result.filename === undefined || typeof result.filename === 'string')
    && (result.contentType === undefined || typeof result.contentType === 'string')
    && (result.fileSizeBytes === undefined || typeof result.fileSizeBytes === 'number')
    && (result.expiresAt === undefined || typeof result.expiresAt === 'string')
    && (result.message === undefined || typeof result.message === 'string')
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/health`, { signal, credentials: 'omit' })
  } catch {
    throw new ApiError(null)
  }
  if (!response.ok) throw new ApiError(response.status)
  return readJson<HealthResponse>(response)
}

export async function validateReelUrl(url: string): Promise<ReelValidationResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/reels/validate`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new ApiError(null)
  }

  if (!response.ok && response.status !== 400) throw new ApiError(response.status)
  const result: unknown = await readJson(response)
  if (!isValidationResponse(result)) throw new ApiError(response.status)
  return result
}

export async function resolveReelUrl(url: string): Promise<MediaResult> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/reels/resolve`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new ApiError(null)
  }

  if (!response.ok && response.status !== 502 && response.status !== 503) throw new ApiError(response.status)
  const result: unknown = await readJson(response)
  if (!isMediaResult(result)) throw new ApiError(response.status)
  if (response.status === 502 && result.status !== 'ERROR') throw new ApiError(502)
  if (response.status === 503 && result.status !== 'UNAVAILABLE') throw new ApiError(503)
  return result
}

export async function downloadReel(url: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/reels/download`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ url }).toString(),
    })
  } catch {
    throw new ApiError(null)
  }

  if (!response.ok) throw new ApiError(response.status)

  const contentType = response.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase()
  const contentLength = Number(response.headers.get('Content-Length'))
  if (contentType !== 'video/mp4'
    || (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES)) {
    throw new ApiError(contentLength > MAX_DOWNLOAD_BYTES ? 413 : 502)
  }

  const blob = await response.blob()
  if (blob.size === 0 || blob.size > MAX_DOWNLOAD_BYTES) {
    throw new ApiError(blob.size > MAX_DOWNLOAD_BYTES ? 413 : 502)
  }
  return blob
}

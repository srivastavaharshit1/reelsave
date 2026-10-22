const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

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
    response = await fetch(`${API_BASE_URL}/api/v1/health`, { signal })
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw new ApiError(null)
  }

  if (!response.ok && response.status !== 503) throw new ApiError(response.status)
  const result: unknown = await readJson(response)
  if (!isMediaResult(result)) throw new ApiError(response.status)
  return result
}

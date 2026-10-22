import type { MediaResult } from '../api/client'

export interface ReadyMediaResult {
  mediaUrl: string
  thumbnailUrl?: string
  filename: string
  contentType: string
  fileSizeBytes?: number
}

const allowedMediaHosts = new Set(
  (import.meta.env.VITE_MEDIA_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
)

function trustedHttpsUrl(value: string | undefined, trustedHosts: ReadonlySet<string>): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || !trustedHosts.has(url.hostname.toLowerCase())) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}

export function toReadyMediaResult(
  result: MediaResult,
  trustedHosts: ReadonlySet<string> = allowedMediaHosts,
): ReadyMediaResult | null {
  if (result.status !== 'READY') return null

  const mediaUrl = trustedHttpsUrl(result.mediaUrl, trustedHosts)
  const filename = result.filename?.trim()
  const contentType = result.contentType?.trim().toLowerCase()
  if (!mediaUrl
    || !filename
    || /[\\/]/.test(filename)
    || Array.from(filename).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
    || !contentType?.startsWith('video/')) {
    return null
  }

  if (result.fileSizeBytes !== undefined
    && (!Number.isSafeInteger(result.fileSizeBytes) || result.fileSizeBytes < 0)) {
    return null
  }

  if (result.expiresAt) {
    const expiry = Date.parse(result.expiresAt)
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return null
  }

  return {
    mediaUrl,
    thumbnailUrl: trustedHttpsUrl(result.thumbnailUrl, trustedHosts),
    filename,
    contentType,
    ...(result.fileSizeBytes === undefined ? {} : { fileSizeBytes: result.fileSizeBytes }),
  }
}

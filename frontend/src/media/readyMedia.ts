import type { MediaResult } from '../api/client'

export interface ReadyMediaResult {
  mediaUrl: string
  thumbnailUrl?: string
  filename: string
  contentType: string
  fileSizeBytes?: number
}

function trustedHttpsUrl(value: string | undefined): string | undefined {
  if (!value || value !== value.trim()) return undefined
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:'
      || url.username
      || url.password
      || url.port
      || url.hash
      || !host.endsWith('.cdninstagram.com')) {
      return undefined
    }
    return value
  } catch {
    return undefined
  }
}

export function toReadyMediaResult(result: MediaResult): ReadyMediaResult | null {
  if (result.status !== 'READY') return null

  const mediaUrl = trustedHttpsUrl(result.mediaUrl)
  const filename = result.filename?.trim()
  const contentType = result.contentType?.trim().toLowerCase()
  if (!mediaUrl
    || !filename
    || filename.length > 104
    || !/^[A-Za-z0-9_-][A-Za-z0-9._-]*\.mp4$/i.test(filename)
    || filename.includes('..')
    || contentType !== 'video/mp4') {
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
    thumbnailUrl: trustedHttpsUrl(result.thumbnailUrl),
    filename,
    contentType,
    ...(result.fileSizeBytes === undefined ? {} : { fileSizeBytes: result.fileSizeBytes }),
  }
}

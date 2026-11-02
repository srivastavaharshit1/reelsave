import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, downloadReel, getHealth, normalizeApiError, resolveReelUrl, validateReelUrl } from './client'

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API error normalization', () => {
  it.each([
    [400, 'Please enter a valid Instagram Reel URL.'],
    [401, 'This request is not authorized.'],
    [403, 'This request is not allowed.'],
    [404, 'The download service could not be found. Please try again later.'],
    [409, 'This link cannot be checked right now. Please try again.'],
    [429, "You're making requests too quickly. Please wait a moment and try again."],
    [500, 'Something went wrong on our side. Please try again.'],
    [503, 'The download service is temporarily unavailable. Please try again later.'],
  ])('maps HTTP %i to a friendly message', (status, message) => {
    expect(normalizeApiError(new ApiError(status))).toBe(message)
  })

  it('maps network errors without exposing the original error text', () => {
    expect(normalizeApiError(new TypeError('socket ECONNREFUSED internal details')))
      .toBe("We couldn't connect to the download service. Please check your connection and try again.")
  })

  it('maps unknown server statuses to a generic server message', () => {
    expect(normalizeApiError(new ApiError(502))).toBe('Something went wrong on our side. Please try again.')
  })
})

describe('Reel API responses', () => {
  it('checks backend health through the centralized client without browser credentials', async () => {
    const health = { status: 'UP', service: 'reelsave-api' }
    const fetchMock = vi.fn().mockResolvedValue(response(200, health))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getHealth()).resolves.toEqual(health)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', {
      signal: undefined,
      credentials: 'omit',
    })
  })

  it('returns validation failures from the existing HTTP 400 contract', async () => {
    const validation = { valid: false, platform: 'instagram', type: null, message: 'Invalid.' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, validation)))

    await expect(validateReelUrl('https://example.com/')).resolves.toEqual(validation)
  })

  it('uses the media status field even when resolve returns HTTP 200', async () => {
    const unavailable = { status: 'UNAVAILABLE', message: 'Private server detail' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, unavailable)))

    await expect(resolveReelUrl('https://www.instagram.com/reel/ABC123/')).resolves.toEqual(unavailable)
  })

  it('accepts the current HTTP 503 and UNAVAILABLE response', async () => {
    const unavailable = { status: 'UNAVAILABLE', message: 'Media download is not currently available.' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, unavailable)))

    await expect(resolveReelUrl('https://www.instagram.com/reel/ABC123/')).resolves.toEqual(unavailable)
  })

  it('does not accept READY from an HTTP 503 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, {
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/example.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    })))

    await expect(resolveReelUrl('https://www.instagram.com/reel/ABC123/'))
      .rejects.toMatchObject({ status: 503 })
  })

  it('preserves an HTTP 502 and ERROR response as a typed media result', async () => {
    const error = { status: 'ERROR', message: 'Internal provider details' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(502, error)))

    await expect(resolveReelUrl('https://www.instagram.com/reel/ABC123/')).resolves.toEqual(error)
  })

  it('does not expose backend response details for an HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(500, { message: 'Database password or stack trace.' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(resolveReelUrl('https://www.instagram.com/reel/ABC123/'))
      .rejects.toMatchObject({ status: 500 })
    expect(normalizeApiError(new ApiError(500))).toBe('Something went wrong on our side. Please try again.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('Reel downloads', () => {
  it('posts only the Reel URL to the dedicated backend download route and returns MP4 bytes', async () => {
    const blob = new Blob(['mp4 bytes'], { type: 'video/mp4' })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'video/mp4' : '8' },
      blob: vi.fn().mockResolvedValue(blob),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(downloadReel('https://www.instagram.com/reel/ABC123/')).resolves.toBe(blob)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/reels/download', expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'url=https%3A%2F%2Fwww.instagram.com%2Freel%2FABC123%2F',
    }))
  })

  it('rejects non-MP4 and empty successful download responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      blob: vi.fn().mockResolvedValue(new Blob(['error'])),
    }))
    await expect(downloadReel('https://www.instagram.com/reel/ABC123/'))
      .rejects.toMatchObject({ status: 502 })
  })

  it('does not expose backend error bodies for failed download requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503, { message: 'internal provider stderr' })))
    await expect(downloadReel('https://www.instagram.com/reel/ABC123/'))
      .rejects.toMatchObject({ status: 503 })
  })
})

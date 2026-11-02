import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, downloadReel, resolveReelUrl, validateReelUrl, type ReelValidationResponse } from '../api/client'
import { saveBlob } from '../media/saveBlob'
import { DownloadForm } from './DownloadForm'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    downloadReel: vi.fn(),
    resolveReelUrl: vi.fn(),
    validateReelUrl: vi.fn(),
  }
})

vi.mock('../media/saveBlob', () => ({ saveBlob: vi.fn() }))

const validUrl = 'https://www.instagram.com/reel/ABC123/'
const validResponse = { valid: true, platform: 'instagram', type: 'reel', message: 'Valid Instagram Reel URL.' }
const invalidResponse = { valid: false, platform: 'instagram', type: null, message: 'Invalid URL.' }
const unavailableResponse = { status: 'UNAVAILABLE' as const, message: 'Internal provider detail must not be shown.' }

const validateMock = vi.mocked(validateReelUrl)
const resolveMock = vi.mocked(resolveReelUrl)
const downloadMock = vi.mocked(downloadReel)
const saveBlobMock = vi.mocked(saveBlob)

function setup() {
  const user = userEvent.setup()
  render(<DownloadForm />)
  return {
    user,
    input: screen.getByRole('textbox', { name: 'Instagram Reel URL' }) as HTMLInputElement,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('DownloadForm workflow', () => {
  beforeEach(() => {
    validateMock.mockReset()
    resolveMock.mockReset()
    downloadMock.mockReset()
    saveBlobMock.mockReset()
  })

  afterEach(cleanup)

  it('keeps the primary action disabled and makes no request for an empty form', async () => {
    const { user, input } = setup()
    const button = screen.getByRole('button', { name: 'Check link' })

    expect((button as HTMLButtonElement).disabled).toBe(true)
    await user.type(input, '{Enter}')
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('validates the trimmed Reel URL and stops on an invalid result', async () => {
    validateMock.mockResolvedValue(invalidResponse)
    const { user, input } = setup()
    await user.type(input, `  ${validUrl}  `)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(validateMock).toHaveBeenCalledWith(validUrl)
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('keeps the entered URL and focuses the field after validation failure', async () => {
    validateMock.mockResolvedValue(invalidResponse)
    const { user, input } = setup()
    await user.type(input, 'https://example.com/not-a-reel')
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(input.value).toBe('https://example.com/not-a-reel')
    await waitFor(() => expect(document.activeElement).toBe(input))
  })

  it('shows unavailable after a valid URL and unavailable media result', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue(unavailableResponse)
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Download service is temporarily unavailable.')
    expect(validateMock).toHaveBeenCalledWith(validUrl)
    expect(resolveMock).toHaveBeenCalledWith(validUrl)
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(screen.queryByText(/internal provider detail/i)).toBeNull()
  })

  it('shows a friendly network message without backend details', async () => {
    validateMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't connect to the download service. Please check your connection and try again.")
    expect(screen.queryByText(/failed to fetch/i)).toBeNull()
  })

  it('prevents duplicate submissions while validation is pending', async () => {
    const validation = deferred<ReelValidationResponse>()
    validateMock.mockReturnValue(validation.promise)
    const { user, input } = setup()
    await user.type(input, validUrl)
    const form = input.closest('form')
    if (!form) throw new Error('Expected URL field to be inside a form')

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(validateMock).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toContain('Checking that Reel link')
    expect((screen.getByRole('button', { name: 'Checking…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(input.disabled).toBe(true)
    validation.resolve(invalidResponse)
    expect(await screen.findByRole('alert')).not.toBeNull()
  })

  it('submits when Enter is pressed in the URL field', async () => {
    validateMock.mockResolvedValue(invalidResponse)
    const { user, input } = setup()
    await user.type(input, `${validUrl}{Enter}`)

    await screen.findByRole('alert')
    expect(validateMock).toHaveBeenCalledWith(validUrl)
  })

  it('allows retry after an error and keeps the URL', async () => {
    validateMock.mockRejectedValueOnce(new ApiError(500)).mockResolvedValueOnce(invalidResponse)
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong on our side. Please try again.')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(input.value).toBe(validUrl)
    expect(validateMock).toHaveBeenCalledTimes(2)
  })

  it('does not render ready media controls for an incomplete READY response', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({ status: 'READY', mediaUrl: 'https://media.example/video.mp4' })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The service did not return a usable media result.')
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(document.querySelector('video')).toBeNull()
  })

  it('renders the backend media URL, filename, and content type for a valid READY response', async () => {
    const mediaUrl = 'https://scontent-del2-2.cdninstagram.com/example.mp4?signature=temporary'
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({
      status: 'READY',
      mediaUrl,
      filename: 'reel-ABC123.mp4',
      contentType: 'video/mp4',
    })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect(await screen.findByRole('heading', { name: 'Your Reel is ready' })).not.toBeNull()
    expect(screen.getByText('reel-ABC123.mp4')).not.toBeNull()
    expect(document.querySelector('video source')?.getAttribute('src')).toBe(mediaUrl)
    expect(document.querySelector('video source')?.getAttribute('type')).toBe('video/mp4')
    expect(screen.getByRole('button', { name: 'Download reel-ABC123.mp4' })).not.toBeNull()
  })

  it('downloads through the backend and saves with the safe provider filename', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/example.mp4',
      filename: 'reel-ABC123.mp4',
      contentType: 'video/mp4',
    })
    const blob = new Blob(['mp4 bytes'], { type: 'video/mp4' })
    downloadMock.mockResolvedValue(blob)
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))
    await screen.findByRole('heading', { name: 'Your Reel is ready' })

    await user.click(screen.getByRole('button', { name: 'Download reel-ABC123.mp4' }))

    await waitFor(() => {
      expect(downloadMock).toHaveBeenCalledWith(validUrl)
      expect(saveBlobMock).toHaveBeenCalledWith(blob, 'reel-ABC123.mp4')
    })
  })

  it('never renders a download target for an invalid READY media URL', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({
      status: 'READY',
      mediaUrl: 'https://cdninstagram.com.evil.example/example.mp4',
      filename: 'reel-ABC123.mp4',
      contentType: 'video/mp4',
    })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('The service did not return a usable media result.')
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(document.querySelector('video')).toBeNull()
  })

  it('shows a generic error for an ERROR media result without exposing provider details', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({ status: 'ERROR', message: 'yt-dlp stderr or process details' })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('We could not prepare this media. Please try again.')
    expect(screen.queryByText(/yt-dlp stderr|process details/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
  })

  it('shows a friendly retry state when the CDN media fails to load', async () => {
    validateMock.mockResolvedValue(validResponse)
    resolveMock.mockResolvedValue({
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/example.mp4',
      filename: 'reel-ABC123.mp4',
      contentType: 'video/mp4',
    })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))
    await screen.findByRole('heading', { name: 'Your Reel is ready' })

    const video = document.querySelector('video')
    if (!video) throw new Error('Expected video preview')
    fireEvent.error(video)

    expect((await screen.findByRole('alert')).textContent)
      .toContain('This media link could not be opened or may have expired.')
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).not.toBeNull()
  })
})

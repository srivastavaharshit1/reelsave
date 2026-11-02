import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, downloadReel, resolveReelUrl, validateReelUrl, type MediaResult } from '../api/client'
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
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('validates the trimmed Reel URL and stops on an invalid result', async () => {
    resolveMock.mockRejectedValue(new ApiError(400))
    const { user, input } = setup()
    await user.type(input, `  ${validUrl}  `)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(resolveMock).toHaveBeenCalledWith(validUrl)
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('keeps the entered URL and focuses the field after validation failure', async () => {
    resolveMock.mockRejectedValue(new ApiError(400))
    const { user, input } = setup()
    await user.type(input, 'https://example.com/not-a-reel')
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(input.value).toBe('https://example.com/not-a-reel')
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('shows unavailable after an unavailable media result', async () => {
    resolveMock.mockResolvedValue(unavailableResponse)
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Download service is temporarily unavailable.')
    expect(resolveMock).toHaveBeenCalledWith(validUrl)
    expect(validateMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(screen.queryByText(/internal provider detail/i)).toBeNull()
  })

  it('shows a friendly network message without backend details', async () => {
    resolveMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain("We couldn't connect to the download service. Please check your connection and try again.")
    expect(screen.queryByText(/failed to fetch/i)).toBeNull()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('prevents duplicate submissions while resolution is pending', async () => {
    const resolution = deferred<MediaResult>()
    resolveMock.mockReturnValue(resolution.promise)
    const { user, input } = setup()
    await user.type(input, validUrl)
    const form = input.closest('form')
    if (!form) throw new Error('Expected URL field to be inside a form')

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(validateMock).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toContain('Connecting to Instagram…')
    expect((screen.getByRole('button', { name: 'Resolving…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(input.disabled).toBe(true)
    resolution.resolve({
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/example.mp4',
      filename: 'reel-ABC123.mp4',
      contentType: 'video/mp4',
    })
    expect(await screen.findByRole('heading', { name: 'Your Reel is ready' })).not.toBeNull()
  })

  it('submits when Enter is pressed in the URL field', async () => {
    resolveMock.mockRejectedValue(new ApiError(400))
    const { user, input } = setup()
    await user.type(input, `${validUrl}{Enter}`)

    await screen.findByRole('alert')
    expect(resolveMock).toHaveBeenCalledWith(validUrl)
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('allows retry after an error and keeps the URL', async () => {
    resolveMock.mockRejectedValueOnce(new ApiError(500)).mockRejectedValueOnce(new ApiError(400))
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Something went wrong on our side. Please try again.')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Please enter a valid Instagram Reel link.')
    expect(input.value).toBe(validUrl)
    expect(resolveMock).toHaveBeenCalledTimes(2)
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('does not render ready media controls for an incomplete READY response', async () => {
    resolveMock.mockResolvedValue({ status: 'READY', mediaUrl: 'https://media.example/video.mp4' })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent).toContain('The service did not return a usable media result.')
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(document.querySelector('video')).toBeNull()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('renders the backend media URL, filename, and content type for a valid READY response', async () => {
    const mediaUrl = 'https://scontent-del2-2.cdninstagram.com/example.mp4?signature=temporary'
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
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('downloads through the backend and saves with the safe provider filename', async () => {
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
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('never renders a download target for an invalid READY media URL', async () => {
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
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('shows a generic error for an ERROR media result without exposing provider details', async () => {
    resolveMock.mockResolvedValue({ status: 'ERROR', message: 'yt-dlp stderr or process details' })
    const { user, input } = setup()
    await user.type(input, validUrl)
    await user.click(screen.getByRole('button', { name: 'Check link' }))

    expect((await screen.findByRole('alert')).textContent)
      .toContain('We could not prepare this media. Please try again.')
    expect(screen.queryByText(/yt-dlp stderr|process details/i)).toBeNull()
    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('shows a friendly retry state when the CDN media fails to load', async () => {
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
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('shows waking up message when server response is slow and transitions to ready on response', async () => {
    vi.useFakeTimers()
    try {
      const resolution = deferred<MediaResult>()
      resolveMock.mockReturnValue(resolution.promise)

      render(<DownloadForm />)
      const input = screen.getByRole('textbox', { name: 'Instagram Reel URL' })
      fireEvent.change(input, { target: { value: validUrl } })
      fireEvent.submit(input.closest('form')!)

      // Initially connecting
      expect(screen.getByRole('status').textContent).toContain('Connecting to Instagram…')

      // At 2.5s -> fetching
      act(() => {
        vi.advanceTimersByTime(2600)
      })
      expect(screen.getByRole('status').textContent).toContain('Fetching Reel information…')

      // At 7s -> slow server message
      act(() => {
        vi.advanceTimersByTime(4500)
      })
      expect(screen.getByRole('status').textContent).toContain('The server is taking longer than usual. Please wait while we process your Reel.')

      // Backend responds -> transitions to READY
      await act(async () => {
        resolution.resolve({
          status: 'READY',
          mediaUrl: 'https://scontent-del2-2.cdninstagram.com/example.mp4',
          filename: 'reel-ABC123.mp4',
          contentType: 'video/mp4',
        })
      })

      expect(screen.getByRole('heading', { name: 'Your Reel is ready' })).not.toBeNull()
      expect(screen.queryByText(/The server is taking longer than usual/i)).toBeNull()
      expect(validateMock).not.toHaveBeenCalled()
      expect(resolveMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

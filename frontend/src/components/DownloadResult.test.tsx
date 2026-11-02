import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { toReadyMediaResult } from '../media/readyMedia'
import { DownloadResult } from './DownloadResult'

afterEach(cleanup)

describe('ready media result', () => {
  it('renders a preview and download controls only from a complete trusted result', () => {
    const result = toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/reel.mp4?signature=temporary',
      thumbnailUrl: 'https://scontent-del2-2.cdninstagram.com/reel.jpg',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 1_048_576,
    })

    expect(result).not.toBeNull()
    render(<DownloadResult result={result!} isDownloading={false} onDownload={() => {}} onMediaError={() => {}} />)

    const video = document.querySelector('video')
    expect(video?.getAttribute('poster')).toBe('https://scontent-del2-2.cdninstagram.com/reel.jpg')
    expect(screen.getByText('reel.mp4')).not.toBeNull()
    expect(screen.getByText('1.0 MB')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Download reel.mp4' })).not.toBeNull()
  })

  it('accepts an HTTPS Instagram CDN subdomain without transforming the URL', () => {
    const url = 'https://scontent-del2-2.cdninstagram.com/example.mp4?signature=temporary'
    const result = toReadyMediaResult({
      status: 'READY',
      mediaUrl: url,
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    })

    expect(result?.mediaUrl).toBe(url)
  })

  it.each([
    ['HTTPS apex host (not accepted by the backend)', 'https://cdninstagram.com/example.mp4'],
    ['HTTP CDN URL', 'http://scontent-del2-2.cdninstagram.com/example.mp4'],
    ['lookalike suffix', 'https://evilcdninstagram.com/example.mp4'],
    ['nested lookalike suffix', 'https://cdninstagram.com.evil.example/example.mp4'],
    ['untrusted HTTPS host', 'https://example.com/example.mp4'],
    ['javascript URL', 'javascript:alert(1)'],
    ['malformed URL', 'https://[not-a-host'],
  ])('rejects %s', (_description, mediaUrl) => {
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl,
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    })).toBeNull()
  })

  it('rejects incomplete, expired, insecure, or untrusted media results', () => {
    expect(toReadyMediaResult({ status: 'READY', filename: 'reel.mp4' })).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'http://scontent-del2-2.cdninstagram.com/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    })).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://other.example/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    })).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://scontent-del2-2.cdninstagram.com/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
      expiresAt: '2000-01-01T00:00:00Z',
    })).toBeNull()
  })
})

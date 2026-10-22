import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { toReadyMediaResult } from '../media/readyMedia'
import { DownloadResult } from './DownloadResult'

afterEach(cleanup)

describe('ready media result', () => {
  const trustedHosts = new Set(['media.example'])

  it('renders a preview and download controls only from a complete trusted result', () => {
    const result = toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://media.example/reel.mp4?signature=temporary',
      thumbnailUrl: 'https://media.example/reel.jpg',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
      fileSizeBytes: 1_048_576,
    }, trustedHosts)

    expect(result).not.toBeNull()
    render(<DownloadResult result={result!} />)

    const video = document.querySelector('video')
    expect(video?.getAttribute('poster')).toBe('https://media.example/reel.jpg')
    expect(screen.getByText('reel.mp4')).not.toBeNull()
    expect(screen.getByText('1.0 MB')).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Download reel.mp4' }).getAttribute('href'))
      .toBe('https://media.example/reel.mp4?signature=temporary')
  })

  it('rejects incomplete, expired, insecure, or untrusted media results', () => {
    expect(toReadyMediaResult({ status: 'READY', filename: 'reel.mp4' }, trustedHosts)).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'http://media.example/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    }, trustedHosts)).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://other.example/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
    }, trustedHosts)).toBeNull()
    expect(toReadyMediaResult({
      status: 'READY',
      mediaUrl: 'https://media.example/reel.mp4',
      filename: 'reel.mp4',
      contentType: 'video/mp4',
      expiresAt: '2000-01-01T00:00:00Z',
    }, trustedHosts)).toBeNull()
  })
})

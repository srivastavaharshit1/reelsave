import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyPageMetadata } from './seo'

describe('page metadata', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    document.head.querySelector('link[rel="canonical"]')?.remove()
    document.head.querySelector('meta[property="og:url"]')?.remove()
    document.head.querySelector('meta[name="robots"]')?.remove()
  })

  it('sets meaningful page titles and descriptions', () => {
    applyPageMetadata('privacy', '/privacy')

    expect(document.title).toBe('Privacy Policy | ReelSave')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content'))
      .toContain('what ReelSave processes')
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content'))
      .toBe('Privacy Policy | ReelSave')
  })

  it('marks unknown routes as non-indexable and omits an unconfigured canonical URL', () => {
    applyPageMetadata('notFound', '/missing')

    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content'))
      .toBe('noindex, nofollow')
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })

  it('sets a canonical URL from the configured public site origin', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'https://reelsave.example')

    applyPageMetadata('privacy', '/privacy')

    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://reelsave.example/privacy')
    expect(document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'))
      .toBe('https://reelsave.example/privacy')
  })

  it('omits canonical metadata when the configured public origin is not HTTPS', () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', 'http://reelsave.example')

    applyPageMetadata('home', '/')

    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull()
  })
})

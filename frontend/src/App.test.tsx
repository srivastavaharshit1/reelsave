import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
})

describe('site routes', () => {
  it.each([
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Service'],
    ['/copyright', 'Copyright and Takedown Policy'],
    ['/contact', 'Abuse and Contact'],
  ])('renders the %s policy page', (path, heading) => {
    window.history.replaceState({}, '', path)

    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: heading })).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'Policies and contact' })).not.toBeNull()
    expect(document.title).toContain(heading.split(' and ')[0])
  })

  it('makes the missing contact configuration clear on the contact page', () => {
    window.history.replaceState({}, '', '/contact')

    render(<App />)

    expect(screen.getByText(/has not published a contact email/i)).not.toBeNull()
  })

  it('renders a useful not found page for unknown routes', () => {
    window.history.replaceState({}, '', '/not-a-page')

    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'We couldn’t find that page.' })).not.toBeNull()
    expect(document.title).toBe('Page Not Found | ReelSave')
  })
})

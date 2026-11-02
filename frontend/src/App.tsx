import { useEffect, useState } from 'react'
import { FeatureSection } from './components/FeatureSection'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { HeroSection } from './components/HeroSection'
import { LegalPage, type LegalPageId } from './components/LegalPage'
import { applyPageMetadata } from './seo'

const legalPages: Record<string, LegalPageId> = {
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/copyright': 'copyright',
  '/contact': 'contact',
}

function currentPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export default function App() {
  const [path, setPath] = useState(currentPath)

  useEffect(() => {
    const updatePath = () => setPath(currentPath())
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  const legalPage = legalPages[path]
  const isHome = path === '/'

  useEffect(() => {
    applyPageMetadata(legalPage ?? (isHome ? 'home' : 'notFound'), path)
  }, [isHome, legalPage, path])

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:shadow-card">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1}>
        {legalPage
          ? <LegalPage page={legalPage} />
          : isHome
            ? <><HeroSection /><FeatureSection /></>
            : <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28"><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Page not found</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">We couldn’t find that page.</h1><p className="mt-4 text-base leading-7 text-muted">The address may have changed. Return to ReelSave to check a public Reel link.</p><a href="/" className="mt-7 inline-flex rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-[#d55f3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Go to ReelSave</a></section>}
      </main>
      <Footer />
    </div>
  )
}

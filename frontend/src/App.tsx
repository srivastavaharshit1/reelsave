import { useEffect, useState } from 'react'
import { getHealth } from './api/client'
import { FeatureSection } from './components/FeatureSection'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { HeroSection } from './components/HeroSection'

export default function App() {
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then((health) => setApiAvailable(health.status === 'UP'))
      .catch(() => setApiAvailable(false))
    return () => controller.abort()
  }, [])

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <Header />
      <main>
        <HeroSection />
        <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-8"><p className="text-right text-xs text-muted" role="status" aria-live="polite">API status: {apiAvailable === null ? 'Checking…' : apiAvailable ? 'Connected' : 'Unavailable'}</p></div>
        <FeatureSection />
      </main>
      <Footer />
    </div>
  )
}

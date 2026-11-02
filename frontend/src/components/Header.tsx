export function Header() {
  return (
    <header className="border-b border-ink/5 bg-canvas/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="ReelSave home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 5.5v13l10-6.5-10-6.5Z" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">reelsave<span className="text-accent">.</span></span>
        </a>
        <nav aria-label="Main navigation" className="flex items-center gap-6 text-sm font-medium text-muted">
          <a className="transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" href="/#how-it-works">How it works</a>
          <a className="hidden transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:inline" href="/#features">Features</a>
        </nav>
      </div>
    </header>
  )
}

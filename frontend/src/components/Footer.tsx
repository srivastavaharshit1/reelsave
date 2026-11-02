export function Footer() {
  return (
    <footer className="bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} ReelSave. All rights reserved.</p>
        <nav aria-label="Policies and contact" className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="/privacy" className="rounded-sm hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Privacy</a>
          <a href="/terms" className="rounded-sm hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Terms</a>
          <a href="/copyright" className="rounded-sm hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Copyright &amp; takedown</a>
          <a href="/contact" className="rounded-sm hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Abuse &amp; contact</a>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-6 text-[10px] leading-4 text-muted/75 sm:px-8">ReelSave is an independent service and is not affiliated with Instagram or Meta.</p>
    </footer>
  )
}

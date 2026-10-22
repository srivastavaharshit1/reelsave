export function Footer() {
  return (
    <footer className="bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {new Date().getFullYear()} ReelSave. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2"><a href="#privacy" className="hover:text-ink">Privacy Policy</a><a href="#terms" className="hover:text-ink">Terms</a><a href="#copyright" className="hover:text-ink">Copyright Policy</a></nav>
      </div>
      <p className="mx-auto max-w-6xl px-5 pb-6 text-[10px] leading-4 text-muted/75 sm:px-8">ReelSave is an independent service and is not affiliated with Instagram or Meta.</p>
    </footer>
  )
}

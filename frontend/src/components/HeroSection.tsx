import { DownloadForm } from './DownloadForm'

export function HeroSection() {
  return (
    <section id="home" className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-32 top-16 h-80 w-80 rounded-full bg-[#e9eee8] blur-3xl" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.15fr_.85fr] lg:gap-20 lg:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-wide text-forest"><span className="h-2 w-2 rounded-full bg-[#71a58b]" /> SIMPLE. CLEAR. YOURS.</div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-ink sm:text-6xl">Download Instagram <span className="text-accent">Reels</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">A straightforward way to save the Reels you’re allowed to download. Paste a link to get started.</p>
          <div className="relative mt-9 max-w-2xl"><DownloadForm /></div>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted"><svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-forest" fill="currentColor"><path fillRule="evenodd" d="M10 1.667a8.333 8.333 0 1 0 0 16.666 8.333 8.333 0 0 0 0-16.666Zm3.089 6.3a.75.75 0 0 0-1.178-.934l-2.81 3.544-1.129-1.128a.75.75 0 0 0-1.06 1.06l1.727 1.728a.75.75 0 0 0 1.12-.064l3.33-4.206Z" clipRule="evenodd" /></svg>Only use content you have permission to download. We respect creator rights and platform safeguards.</p>
          <div id="how-it-works" className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted"><span><b className="mr-2 text-accent">01</b>Paste a link</span><span><b className="mr-2 text-accent">02</b>Check eligibility</span><span><b className="mr-2 text-accent">03</b>Save when available</span></div>
        </div>
        <div className="mx-auto w-full max-w-sm lg:max-w-none" aria-label="Media service status">
          <div className="relative mx-auto aspect-[.82] max-w-[330px] rounded-[2rem] border border-ink/10 bg-white p-3 shadow-card sm:rotate-2">
            <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-[#e8eee9]">
              <div className="flex items-center justify-between px-5 py-4"><span className="text-xs font-semibold text-ink">Media service</span><span className="text-xs text-muted">Current status</span></div>
              <div className="mx-3 flex flex-1 flex-col items-center justify-center rounded-2xl bg-[#c8d8cc] px-8 text-center">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mb-4 h-8 w-8 text-forest" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" strokeLinecap="round" /></svg>
                <p className="text-sm font-semibold text-ink">Media preview unavailable</p>
                <p className="mt-2 text-xs leading-5 text-muted">Reel links can be checked, but media is not available yet.</p>
              </div>
              <div className="m-3 flex items-center gap-3 rounded-xl bg-white p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f8e8e2] text-accent"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" strokeLinecap="round" /></svg></div><div><p className="text-xs font-semibold text-ink">Provider status</p><p className="mt-0.5 text-[10px] text-muted">Unavailable</p></div><span className="ml-auto h-2 w-2 rounded-full bg-muted" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

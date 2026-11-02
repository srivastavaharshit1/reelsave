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
        <div className="mx-auto w-full max-w-sm lg:max-w-none" aria-label="How ReelSave works">
          <div className="relative mx-auto aspect-[.82] max-w-[330px] rounded-[2rem] border border-ink/10 bg-white p-3 shadow-card sm:rotate-2">
            <div className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-[#e8eee9]">
              <div className="flex items-center justify-between px-5 py-4"><span className="text-xs font-semibold text-ink">A clear, simple flow</span><span className="text-xs text-muted">Three steps</span></div>
              <div className="mx-3 flex flex-1 flex-col justify-center rounded-2xl bg-[#c8d8cc] px-5 py-5">
                <ol className="space-y-5">
                  <li className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-forest">01</span><span><strong className="block text-sm text-ink">Paste a public link</strong><span className="mt-0.5 block text-xs text-muted">No account or sign-in needed</span></span></li>
                  <li className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-forest">02</span><span><strong className="block text-sm text-ink">We check availability</strong><span className="mt-0.5 block text-xs text-muted">Some Reels may not be accessible</span></span></li>
                  <li className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-forest">03</span><span><strong className="block text-sm text-ink">Save when available</strong><span className="mt-0.5 block text-xs text-muted">Download only with permission</span></span></li>
                </ol>
              </div>
              <div className="m-3 flex items-center gap-3 rounded-xl bg-white p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#f8e8e2] text-accent"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 8 4v5c0 4.7-3.2 7.7-8 9-4.8-1.3-8-4.3-8-9V7l8-4Z" strokeLinejoin="round" /><path d="m8.5 12 2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" /></svg></div><div><p className="text-xs font-semibold text-ink">Public links only</p><p className="mt-0.5 text-[10px] text-muted">No private-content access</p></div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const features = [
  { number: '01', title: 'Fast', copy: 'A simple flow gets you from link to next step without the clutter.', icon: '↗' },
  { number: '02', title: 'Simple', copy: 'Paste a Reel URL and get clear feedback on what happens next.', icon: '⌁' },
  { number: '03', title: 'Mobile friendly', copy: 'A thoughtful layout that feels right on the screen in your hand.', icon: '▯' },
]

export function FeatureSection() {
  return (
    <section id="features" className="border-y border-ink/5 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-lg"><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Made for the moments</p><h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Less fuss, more focus.</h2></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3 sm:gap-5">
          {features.map((feature) => <article key={feature.number} className="rounded-2xl border border-ink/8 bg-canvas p-6"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e7eee8] text-xl text-forest">{feature.icon}</span><span className="text-xs font-semibold tracking-widest text-muted/60">{feature.number}</span></div><h3 className="mt-6 text-lg font-semibold text-ink">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{feature.copy}</p></article>)}
        </div>
      </div>
    </section>
  )
}

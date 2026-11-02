export type SeoPage = 'home' | 'privacy' | 'terms' | 'copyright' | 'contact' | 'notFound'

const metadata: Record<SeoPage, { title: string; description: string; robots?: string }> = {
  home: {
    title: 'Download Instagram Reels | ReelSave',
    description: 'Check public Instagram Reel links and save an MP4 when it is available. No sign-in, cookies, or private-account access.',
  },
  privacy: {
    title: 'Privacy Policy | ReelSave',
    description: 'Learn what ReelSave processes when you check a public Instagram Reel and how temporary media is handled.',
  },
  terms: {
    title: 'Terms of Service | ReelSave',
    description: 'Read the terms for using ReelSave with public Instagram Reels you have permission to download.',
  },
  copyright: {
    title: 'Copyright and Takedown Policy | ReelSave',
    description: 'How to report copyright concerns about ReelSave’s service and where to find formal notice information.',
  },
  contact: {
    title: 'Abuse and Contact | ReelSave',
    description: 'Contact ReelSave about service abuse, safety concerns, security issues, or account-free support.',
  },
  notFound: {
    title: 'Page Not Found | ReelSave',
    description: 'The requested ReelSave page could not be found.',
    robots: 'noindex, nofollow',
  },
}

function setMeta(selector: string, attribute: string, value: string | undefined): void {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  if (!value) {
    element?.remove()
    return
  }
  if (!element) {
    element = document.createElement('meta')
    const [key, name] = attribute.split('=')
    if (!key || !name) return
    element.setAttribute(key, name)
    document.head.append(element)
  }
  element.content = value
}

function canonicalUrl(path: string): string | undefined {
  const rawBase = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (!rawBase) return undefined
  try {
    const base = new URL(rawBase)
    if (base.protocol !== 'https:'
      || base.username
      || base.password
      || base.search
      || base.hash) return undefined
    const prefix = base.pathname.replace(/\/+$/, '')
    const route = path === '/' ? '' : path.replace(/^\/+/, '')
    base.pathname = `${prefix}/${route}`.replace(/\/{2,}/g, '/') || '/'
    base.search = ''
    base.hash = ''
    return base.toString()
  } catch {
    return undefined
  }
}

export function applyPageMetadata(page: SeoPage, path: string): void {
  const pageMetadata = metadata[page]
  document.title = pageMetadata.title
  setMeta('meta[name="description"]', 'name=description', pageMetadata.description)
  setMeta('meta[name="robots"]', 'name=robots', pageMetadata.robots)
  setMeta('meta[property="og:title"]', 'property=og:title', pageMetadata.title)
  setMeta('meta[property="og:description"]', 'property=og:description', pageMetadata.description)

  const canonical = canonicalUrl(path)
  let canonicalElement = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  let openGraphUrl = document.head.querySelector<HTMLMetaElement>('meta[property="og:url"]')
  if (!canonical) {
    canonicalElement?.remove()
    openGraphUrl?.remove()
    return
  }

  if (!canonicalElement) {
    canonicalElement = document.createElement('link')
    canonicalElement.rel = 'canonical'
    document.head.append(canonicalElement)
  }
  canonicalElement.href = canonical
  if (!openGraphUrl) {
    openGraphUrl = document.createElement('meta')
    openGraphUrl.setAttribute('property', 'og:url')
    document.head.append(openGraphUrl)
  }
  openGraphUrl.content = canonical
}

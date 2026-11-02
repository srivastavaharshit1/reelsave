export type LegalPageId = 'privacy' | 'terms' | 'copyright' | 'contact'

const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() ?? ''
const CONTACT_EMAIL_PATTERN = /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const contactEmail = CONTACT_EMAIL_PATTERN.test(CONTACT_EMAIL) ? CONTACT_EMAIL : undefined

const pageTitles: Record<LegalPageId, { eyebrow: string; title: string; summary: string }> = {
  privacy: {
    eyebrow: 'Your information',
    title: 'Privacy Policy',
    summary: 'This policy explains what happens to a link when you check a Reel and what ReelSave keeps while it works.',
  },
  terms: {
    eyebrow: 'Using ReelSave',
    title: 'Terms of Service',
    summary: 'Use ReelSave only for public Reels you are allowed to save, and respect the rights of the people who made them.',
  },
  copyright: {
    eyebrow: 'Rights and reports',
    title: 'Copyright and Takedown Policy',
    summary: 'Report a copyright concern about ReelSave’s service. We do not host the original Instagram post.',
  },
  contact: {
    eyebrow: 'Get in touch',
    title: 'Abuse and Contact',
    summary: 'Use the contact details below for service abuse, safety concerns, security issues, or help with ReelSave.',
  },
}

function ContactDetails() {
  if (contactEmail) {
    return <p className="mt-4 text-sm leading-6 text-muted">Email <a className="font-medium text-forest underline decoration-forest/40 underline-offset-4 hover:decoration-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={`mailto:${contactEmail}`}>{contactEmail}</a>. Include only the information needed to review your report.</p>
  }
  return <p className="mt-4 rounded-xl border border-[#e9d7b3] bg-[#fff9ee] p-4 text-sm leading-6 text-ink">This deployment has not published a contact email. Do not send sensitive information until the site operator publishes a working address.</p>
}

function PrivacyContent() {
  return <>
    <h2>Information processed</h2>
    <p>ReelSave does not require an account and does not ask for Instagram passwords, cookies, or browser sessions. When you check a link, your Reel URL is sent to the ReelSave backend for validation and, if the provider is enabled, to yt-dlp to request public media information from Instagram. A successful result may contain a temporary media link that is kept in the page while you use it.</p>
    <p>Your browser contacts the media CDN to play a preview. When you download, the backend obtains the selected media and streams it to your browser. Instagram, its media CDN, and the network and hosting providers involved receive the technical information needed to deliver those requests under their own policies.</p>
    <h2>Storage and retention</h2>
    <p>ReelSave has no user accounts or database and does not intentionally retain submitted Reel URLs. Download files are held in a temporary server directory for the response and are removed after the response or a failed operation. Cleanup is best effort if the server process stops unexpectedly. Hosting infrastructure may keep security or access logs according to its own configuration.</p>
    <p>The website does not include advertising or an analytics SDK. The application API sends requests without browser credentials and does not use tracking cookies. Your browser or network provider may still cache or record activity under its own settings.</p>
    <h2>Messages and privacy requests</h2>
    <p>If you contact the site operator, the information in your message and reply address will be used to review and respond to that request. Do not include passwords, cookies, identity documents, or other sensitive information that is not needed.</p>
    <ContactDetails />
    <h2>Changes</h2>
    <p>This policy may be updated when the service or its data handling changes. The date below identifies the current version.</p>
  </>
}

function TermsContent() {
  return <>
    <h2>What ReelSave does</h2>
    <p>ReelSave checks public Instagram Reel links and, when its provider can retrieve a suitable file, lets you preview and download an MP4. Availability depends on the Reel, the provider, and the network. A valid link does not guarantee that media can be retrieved.</p>
    <h2>Your responsibilities</h2>
    <p>Use the service only for public Reels and only when you own the content or have permission and a lawful basis to save it. You are responsible for respecting copyright, privacy, publicity rights, Instagram’s terms, and applicable laws. Do not use ReelSave to access private content or to bypass logins, cookies, CAPTCHA, rate limits, or other access controls.</p>
    <p>Do not abuse the service, interfere with its operation, submit malicious input, or attempt to access systems or content you are not authorized to use. We may limit or suspend requests to protect the service and others.</p>
    <h2>Availability and limits</h2>
    <p>ReelSave is provided without a promise that a particular Reel will be available, that a media link will remain valid, or that the service will be uninterrupted. Downloads are limited by the service’s current size and format limits. Instagram or the provider may make content unavailable at any time.</p>
    <h2>Independent service</h2>
    <p>ReelSave is not affiliated with, endorsed by, or sponsored by Instagram or Meta. Their names and marks belong to their respective owners. Nothing in these terms grants you rights to content you download.</p>
    <h2>Service changes and contact</h2>
    <p>ReelSave may change or discontinue features, including to respond to safety, rights, or technical concerns. Terms are subject to applicable law and do not limit rights that cannot legally be limited.</p>
    <ContactDetails />
  </>
}

function CopyrightContent() {
  return <>
    <h2>Report a concern</h2>
    <p>If you believe ReelSave’s service is making a specific public Reel available without permission, send a report to the published contact address. Include the Reel URL, identify the work and the right you hold, explain your concern, and provide a way to reach you. If you represent a rights holder, identify that relationship. Please provide accurate information and send only details needed to assess the report.</p>
    <p>We will review reports about this service and may disable ReelSave processing for a reported link. ReelSave does not host the original Instagram post and cannot remove it from Instagram; contact Instagram or Meta directly to report content on their platform.</p>
    <ContactDetails />
    <h2>Formal notices</h2>
    <p>A report to a general contact address is not necessarily a formal notice to a registered copyright agent. For a formal notice under U.S. copyright law, check the <a className="font-medium text-forest underline decoration-forest/40 underline-offset-4 hover:decoration-forest focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href="https://www.copyright.gov/dmca-directory/" target="_blank" rel="noreferrer">U.S. Copyright Office Designated Agent Directory</a> for any current ReelSave registration and follow its notice requirements. This page does not claim that ReelSave has registered an agent or qualifies for a statutory safe harbor.</p>
    <p>Do not send a counter-notice to ReelSave unless you are responding to a removal action taken by ReelSave and have been given the appropriate registered-agent details.</p>
  </>
}

function ContactContent() {
  return <>
    <h2>Service reports</h2>
    <p>Contact the ReelSave operator about service abuse, safety concerns, security issues, copyright reports, or a problem using the website. Include the relevant ReelSave page or public Reel URL and a brief description. Never send Instagram credentials, cookies, or browser-session data.</p>
    <ContactDetails />
    <h2>What to expect</h2>
    <p>ReelSave does not provide private-account access and cannot remove the original Reel from Instagram. The service may be unable to retrieve a public link when Instagram or the network makes it unavailable. Reports are reviewed as the operator is able; no response time is guaranteed.</p>
  </>
}

const pageContent: Record<LegalPageId, () => React.ReactNode> = {
  privacy: PrivacyContent,
  terms: TermsContent,
  copyright: CopyrightContent,
  contact: ContactContent,
}

export function LegalPage({ page }: { page: LegalPageId }) {
  const { eyebrow, title, summary } = pageTitles[page]
  const Content = pageContent[page]

  return (
    <div className="bg-canvas">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
        <a href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-forest hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">← Back to ReelSave</a>
        <article className="rounded-3xl border border-ink/10 bg-white px-5 py-7 shadow-card sm:px-9 sm:py-10 lg:px-12">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-accent">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{summary}</p>
          <p className="mt-3 text-xs text-muted">Effective date: October 23, 2026</p>
          <div className="legal-copy mt-8 border-t border-ink/10 pt-7 text-sm leading-7 text-muted">
            <Content />
          </div>
        </article>
      </div>
    </div>
  )
}

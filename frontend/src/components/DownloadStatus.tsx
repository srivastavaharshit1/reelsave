import type { DownloadWorkflowState } from '../hooks/useDownloadWorkflow'

interface DownloadStatusProps {
  state: DownloadWorkflowState
}

export function DownloadStatus({ state }: DownloadStatusProps) {
  switch (state.status) {
    case 'IDLE':
    case 'READY':
      return null
    case 'VALIDATING':
      return <p id="form-message" role="status" aria-live="polite" className="mt-2 flex items-center gap-2 px-3 text-left text-sm text-muted"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-accent" aria-hidden="true" />Checking that Reel link…</p>
    case 'INVALID_URL':
      return <p id="form-message" role="alert" className="mt-2 px-3 text-left text-sm text-red-700">Please enter a valid Instagram Reel link.</p>
    case 'VALID_URL':
      return <p id="form-message" role="status" aria-live="polite" className="mt-2 px-3 text-left text-sm text-forest">Link is valid.</p>
    case 'RESOLVING':
      return (
        <p id="form-message" role="status" aria-live="polite" className="mt-2 flex items-center gap-2 px-3 text-left text-sm text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-accent" aria-hidden="true" />
          {state.stage === 'waking_up'
            ? 'The server is taking longer than usual. Please wait while we process your Reel.'
            : state.stage === 'fetching'
              ? 'Fetching Reel information…'
              : 'Connecting to Instagram…'}
        </p>
      )
    case 'PROCESSING':
      return <p id="form-message" role="status" aria-live="polite" className="mt-2 px-3 text-left text-sm text-muted">Media is still being prepared. Please check again shortly.</p>
    case 'DOWNLOADING':
      return <p id="form-message" role="status" aria-live="polite" className="mt-2 flex items-center gap-2 px-3 text-left text-sm text-muted"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-accent" aria-hidden="true" />Preparing your download…</p>
    case 'UNAVAILABLE':
      return <p id="form-message" role="alert" className="mt-2 px-3 text-left text-sm text-ink">Download service is temporarily unavailable.</p>
    case 'ERROR':
      return <p id="form-message" role="alert" className="mt-2 px-3 text-left text-sm text-red-700">{state.message}</p>
  }
}

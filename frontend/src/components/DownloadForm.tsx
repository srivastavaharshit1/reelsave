import { useEffect, useRef, useState, type FormEvent } from 'react'
import { DownloadResult } from './DownloadResult'
import { DownloadStatus } from './DownloadStatus'
import { useDownloadWorkflow, type DownloadWorkflowState } from '../hooks/useDownloadWorkflow'

function isBusy(status: DownloadWorkflowState['status']): boolean {
  return status === 'VALIDATING' || status === 'VALID_URL' || status === 'RESOLVING'
}

export function DownloadForm() {
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { state, submit, reset } = useDownloadWorkflow()
  const busy = isBusy(state.status)

  useEffect(() => {
    if (state.status === 'INVALID_URL') inputRef.current?.focus()
  }, [state.status])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!url.trim() || busy) return
    void submit(url)
  }

  function handleChange(value: string) {
    setUrl(value)
    if (!busy) reset()
  }

  function handleClear() {
    setUrl('')
    reset()
    inputRef.current?.focus()
  }

  const buttonLabel = state.status === 'ERROR' || state.status === 'UNAVAILABLE'
    ? 'Try again'
    : state.status === 'PROCESSING'
      ? 'Check again'
      : 'Check link'

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        aria-busy={busy}
        className="rounded-2xl border border-ink/10 bg-white p-2 shadow-card transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 sm:flex sm:items-center"
        noValidate
      >
        <label htmlFor="reel-url" className="sr-only">Instagram Reel URL</label>
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:py-2">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.5 13.5a4.5 4.5 0 0 0 6.36 0l3-3a4.5 4.5 0 0 0-6.36-6.36l-1.72 1.72M13.5 10.5a4.5 4.5 0 0 0-6.36 0l-3 3a4.5 4.5 0 0 0 6.36 6.36l1.72-1.72" strokeLinecap="round" /></svg>
          <input
            ref={inputRef}
            id="reel-url"
            name="reel-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="Paste an Instagram Reel link"
            value={url}
            onChange={(event) => handleChange(event.target.value)}
            aria-describedby={state.status === 'IDLE' || state.status === 'READY' ? undefined : 'form-message'}
            aria-invalid={state.status === 'INVALID_URL' || state.status === 'ERROR'}
            disabled={busy}
            className="w-full min-w-0 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70 focus:ring-0 disabled:opacity-70"
          />
          {url && !busy && <button type="button" onClick={handleClear} aria-label="Clear URL" className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">Clear</button>}
        </div>
        <button
          type="submit"
          disabled={!url.trim() || busy}
          className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#d55f3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
          {busy ? state.status === 'VALIDATING' ? 'Checking…' : 'Resolving…' : buttonLabel}
        </button>
      </form>
      <DownloadStatus state={state} />
      {state.status === 'READY' && <DownloadResult result={state.result} />}
    </div>
  )
}

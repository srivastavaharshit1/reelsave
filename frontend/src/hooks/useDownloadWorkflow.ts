import { useCallback, useRef, useState } from 'react'
import { normalizeApiError, resolveReelUrl, validateReelUrl, type MediaResult } from '../api/client'
import { toReadyMediaResult, type ReadyMediaResult } from '../media/readyMedia'

export type DownloadWorkflowState =
  | { status: 'IDLE' }
  | { status: 'VALIDATING'; url: string }
  | { status: 'INVALID_URL'; url: string }
  | { status: 'VALID_URL'; url: string }
  | { status: 'RESOLVING'; url: string }
  | { status: 'PROCESSING'; url: string }
  | { status: 'READY'; url: string; result: ReadyMediaResult }
  | { status: 'UNAVAILABLE'; url: string }
  | { status: 'ERROR'; url: string; message: string }

function pauseForPaint(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0))
}

function resolveMediaState(url: string, result: MediaResult): DownloadWorkflowState {
  switch (result.status) {
    case 'READY': {
      const readyResult = toReadyMediaResult(result)
      return readyResult
        ? { status: 'READY', url, result: readyResult }
        : { status: 'ERROR', url, message: 'The service did not return a usable media result. Please try again later.' }
    }
    case 'PROCESSING':
      return { status: 'PROCESSING', url }
    case 'UNAVAILABLE':
      return { status: 'UNAVAILABLE', url }
    case 'ERROR':
      return { status: 'ERROR', url, message: 'We could not prepare this media. Please try again.' }
  }
}

export function useDownloadWorkflow() {
  const [state, setState] = useState<DownloadWorkflowState>({ status: 'IDLE' })
  const requestInProgress = useRef(false)

  const submit = useCallback(async (rawUrl: string) => {
    const url = rawUrl.trim()
    if (!url || requestInProgress.current) return

    requestInProgress.current = true
    setState({ status: 'VALIDATING', url })
    try {
      const validation = await validateReelUrl(url)
      if (!validation.valid) {
        setState({ status: 'INVALID_URL', url })
        return
      }

      setState({ status: 'VALID_URL', url })
      await pauseForPaint()
      setState({ status: 'RESOLVING', url })

      const result = await resolveReelUrl(url)
      setState(resolveMediaState(url, result))
    } catch (error) {
      setState({ status: 'ERROR', url, message: normalizeApiError(error) })
    } finally {
      requestInProgress.current = false
    }
  }, [])

  const reset = useCallback(() => {
    if (!requestInProgress.current) setState({ status: 'IDLE' })
  }, [])

  return { state, submit, reset }
}

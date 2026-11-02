import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadReel, normalizeApiError, resolveReelUrl, validateReelUrl, type MediaResult } from '../api/client'
import { toReadyMediaResult, type ReadyMediaResult } from '../media/readyMedia'
import { saveBlob } from '../media/saveBlob'

export type ResolvingStage = 'connecting' | 'fetching'

export type DownloadWorkflowState =
  | { status: 'IDLE' }
  | { status: 'VALIDATING'; url: string }
  | { status: 'INVALID_URL'; url: string }
  | { status: 'VALID_URL'; url: string }
  | { status: 'RESOLVING'; url: string; stage: ResolvingStage }
  | { status: 'PROCESSING'; url: string }
  | { status: 'READY'; url: string; result: ReadyMediaResult }
  | { status: 'DOWNLOADING'; url: string; result: ReadyMediaResult }
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
  const stageTimerRef = useRef<number | null>(null)

  const clearStageTimer = useCallback(() => {
    if (stageTimerRef.current !== null) {
      window.clearTimeout(stageTimerRef.current)
      stageTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearStageTimer(), [clearStageTimer])

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
      setState({ status: 'RESOLVING', url, stage: 'connecting' })

      clearStageTimer()
      stageTimerRef.current = window.setTimeout(() => {
        setState((current) =>
          current.status === 'RESOLVING' ? { ...current, stage: 'fetching' } : current
        )
      }, 2500)

      const result = await resolveReelUrl(url)
      clearStageTimer()
      setState(resolveMediaState(url, result))
    } catch (error) {
      clearStageTimer()
      setState({ status: 'ERROR', url, message: normalizeApiError(error) })
    } finally {
      clearStageTimer()
      requestInProgress.current = false
    }
  }, [clearStageTimer])

  const reset = useCallback(() => {
    if (!requestInProgress.current) {
      clearStageTimer()
      setState({ status: 'IDLE' })
    }
  }, [clearStageTimer])

  const reportMediaFailure = useCallback(() => {
    setState((current) => current.status === 'READY'
      ? {
          status: 'ERROR',
          url: current.url,
          message: 'This media link could not be opened or may have expired. Check the Reel again to get a fresh link.',
        }
      : current)
  }, [])

  const download = useCallback(async () => {
    if (state.status !== 'READY' || requestInProgress.current) return

    const readyState = state
    requestInProgress.current = true
    setState({ status: 'DOWNLOADING', url: readyState.url, result: readyState.result })
    try {
      const blob = await downloadReel(readyState.url)
      saveBlob(blob, readyState.result.filename)
      setState(readyState)
    } catch (error) {
      setState({
        status: 'ERROR',
        url: readyState.url,
        message: normalizeApiError(error),
      })
    } finally {
      requestInProgress.current = false
    }
  }, [state])

  return { state, submit, reset, reportMediaFailure, download }
}

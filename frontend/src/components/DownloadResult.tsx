import type { ReadyMediaResult } from '../media/readyMedia'

interface DownloadResultProps {
  result: ReadyMediaResult
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = -1
  do {
    size /= 1024
    unitIndex += 1
  } while (size >= 1024 && unitIndex < units.length - 1)
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

export function DownloadResult({ result }: DownloadResultProps) {
  return (
    <section aria-labelledby="download-result-title" className="mt-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-card">
      <h2 id="download-result-title" className="text-sm font-semibold text-ink">Your Reel is ready</h2>
      <video className="mt-3 w-full rounded-xl bg-black" controls preload="metadata" poster={result.thumbnailUrl}>
        <source src={result.mediaUrl} type={result.contentType} />
        Your browser does not support video playback.
      </video>
      <p className="mt-3 break-words text-sm font-medium text-ink">{result.filename}</p>
      {result.fileSizeBytes !== undefined && <p className="mt-1 text-xs text-muted">{formatFileSize(result.fileSizeBytes)}</p>}
      <a href={result.mediaUrl} download={result.filename} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#d55f3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto" aria-label={`Download ${result.filename}`}>
        Download video
      </a>
    </section>
  )
}

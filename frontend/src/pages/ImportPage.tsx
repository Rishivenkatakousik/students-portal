import { useState } from 'react'
import { ErrorAlert } from '../components/ErrorAlert'
import { FileDrop } from '../components/imports/FileDrop'
import { ImportOutcome } from '../components/imports/ImportOutcome'
import { RecentImports } from '../components/imports/RecentImports'
import { UploadError } from '../components/imports/UploadError'
import { UploadProgress } from '../components/imports/UploadProgress'
import { REQUIRED_COLUMNS } from '../constants/fields'
import { useUploadImport } from '../hooks/queries'
import { btnPrimary, spinner } from '../styles/ui'
import { formatBytes } from '../utils/format'

// Mirrors MAX_UPLOAD_MB on the backend, so an oversized file is refused
// before it is uploaded. The server still enforces its own limit.
const MAX_UPLOAD_MB = 10

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const upload = useUploadImport(setProgress)

  function choose(chosen: File | undefined) {
    if (!chosen) return
    upload.reset() // results on screen belong to the previous file
    setFile(chosen)
    setLocalError(
      chosen.size > MAX_UPLOAD_MB * 1024 * 1024
        ? `This file is ${formatBytes(chosen.size)}; the limit is ${MAX_UPLOAD_MB} MB. Split it into smaller files and upload them one by one.`
        : null,
    )
  }

  function start() {
    if (file && !localError) {
      setProgress(0)
      upload.mutate(file)
    }
  }

  return (
    <>
      <h1>Import student results</h1>
      <p className="mb-6 text-muted">
        Upload a CSV exported from your spreadsheet. Valid rows are imported; rows with problems are listed below so you
        can fix them.
      </p>

      <div className="mb-4 grid items-center gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <FileDrop file={file} disabled={upload.isPending} onChoose={choose} />
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">
            <strong>Required columns</strong> (any order, extra columns are ignored):{' '}
            {REQUIRED_COLUMNS.map((c, i) => (
              <span key={c}>
                <code>{c}</code>
                {i < REQUIRED_COLUMNS.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
          <button
            type="button"
            className={btnPrimary}
            onClick={start}
            disabled={!file || Boolean(localError) || upload.isPending}
          >
            {upload.isPending && <span className={spinner} aria-hidden="true" />}
            {upload.isPending ? 'Importing…' : 'Upload and import'}
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {localError && <ErrorAlert title="This file is too large" message={localError} />}
        {upload.isPending && file && <UploadProgress file={file} percent={progress} />}
        {upload.isError && <UploadError error={upload.error} onRetry={start} />}
        {upload.isSuccess && <ImportOutcome result={upload.data} />}
      </div>

      <RecentImports />
    </>
  )
}

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useId, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError, type ImportResult, type Problem } from '../api'
import { Pagination } from '../components/Pagination'
import { FIELD_LABELS, formatBytes, formatNumber, REQUIRED_COLUMNS } from '../format'
import { alertError, alertSuccess, btnPrimary, btnSecondary, btnSecondarySmall, spinner, stackedTable, tableWrap } from '../ui'

// Mirrors MAX_UPLOAD_MB on the backend, so an oversized file is refused
// before it is uploaded. The server still enforces its own limit.
const MAX_UPLOAD_MB = 10
const PROBLEMS_PAGE_SIZE = 50

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const upload = useMutation({ mutationFn: (chosen: File) => api.uploadImport(chosen, setProgress) })

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
        {localError && <ErrorBox title="This file is too large" message={localError} />}
        {upload.isPending && file && <UploadProgress file={file} percent={progress} />}
        {upload.isError && <UploadError error={upload.error} onRetry={start} />}
        {upload.isSuccess && <ImportOutcome result={upload.data} />}
      </div>
    </>
  )
}

function UploadProgress({ file, percent }: { file: File; percent: number }) {
  const uploading = percent < 100
  return (
    <div className="my-4 max-w-md">
      <p className="mb-1.5 text-sm text-muted">
        {uploading
          ? `Uploading ${formatBytes(file.size)}… ${percent}%`
          : 'Uploaded. Checking every row; this usually takes a few seconds…'}
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function FileDrop({
  file,
  disabled,
  onChoose,
}: {
  file: File | null
  disabled: boolean
  onChoose: (file: File | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintId = useId()

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) onChoose(event.dataTransfer.files[0])
  }

  return (
    <div
      className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line bg-white'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p className="font-semibold">Drag and drop a CSV file here</p>
      <p className="mt-1 mb-2 text-sm text-muted" id={hintId}>
        or
      </p>
      <button
        type="button"
        className={btnSecondary}
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Choose file
      </button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onChoose(e.target.files?.[0])
          e.target.value = '' // allow choosing the same file again
        }}
      />
      {file && (
        <p className="mt-4 wrap-anywhere">
          Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
        </p>
      )}
    </div>
  )
}

function ErrorBox({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className={alertError} role="alert">
      <strong>{title}</strong>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button type="button" className={`${btnSecondarySmall} mt-3`} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

function UploadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null
  const status = apiError?.status ?? 500
  if (status >= 400 && status < 500) {
    // The file itself is the problem: retrying the same file won't help.
    return <ErrorBox title="This file can't be imported" message={error.message} />
  }
  const unreachable = status === 0 || apiError?.code === 'SERVER_UNAVAILABLE'
  const title = unreachable ? "Couldn't reach the server" : 'The import did not finish'
  return <ErrorBox title={title} message={error.message} onRetry={onRetry} />
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'success' | 'danger' }) {
  const tones = {
    success: 'border-success-line bg-success-soft [&>span:first-child]:text-success',
    danger: 'border-danger-line bg-danger-soft [&>span:first-child]:text-danger',
  }
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border p-4 ${tone ? tones[tone] : 'border-line bg-white'}`}>
      <span className="text-[1.75rem] leading-tight font-bold">{formatNumber(value)}</span>
      <span className="text-sm text-muted">{label}</span>
    </div>
  )
}

function ImportOutcome({ result }: { result: ImportResult }) {
  const { summary } = result
  return (
    <section className="mt-2" aria-label="Import result">
      <div className="my-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <Stat value={summary.rows_read} label="rows read" />
        <Stat
          value={summary.imported}
          tone="success"
          label={`imported (${formatNumber(summary.new)} new, ${formatNumber(summary.updated)} updated, ${formatNumber(summary.unchanged)} unchanged)`}
        />
        <Stat value={summary.rejected} label="rows rejected" tone={summary.rejected > 0 ? 'danger' : undefined} />
      </div>

      {summary.extra_columns.length > 0 && (
        <p className="text-sm text-muted">
          Ignored extra columns: {summary.extra_columns.map((c) => `"${c}"`).join(', ')}.
        </p>
      )}

      {summary.rejected === 0 ? (
        <div className={alertSuccess}>
          Every row was imported. <Link to="/students">View students</Link>
        </div>
      ) : (
        <>
          <p className="my-4 text-muted">
            Rejected rows were not imported. Fix them in your spreadsheet and upload the file again: students already
            imported are updated, never duplicated. <Link to="/students">View imported students</Link>
          </p>
          <ProblemsTable importId={summary.id} firstPage={result.problems} />
        </>
      )}
    </section>
  )
}

function ProblemsTable({ importId, firstPage }: { importId: number; firstPage: ImportResult['problems'] }) {
  const [page, setPage] = useState(1)
  const problems = useQuery({
    queryKey: ['import-problems', importId, page],
    queryFn: () => api.importProblems(importId, page, PROBLEMS_PAGE_SIZE),
    initialData: page === 1 ? firstPage : undefined,
    placeholderData: keepPreviousData,
  })
  const data = problems.data ?? firstPage

  return (
    <section aria-labelledby="problems-heading">
      <h2 id="problems-heading">Row problems</h2>
      {problems.isError && (
        <ErrorBox
          title="Couldn't load this page of problems"
          message={problems.error.message}
          onRetry={() => problems.refetch()}
        />
      )}
      <div className={`${tableWrap} ${problems.isFetching ? 'opacity-60' : ''} transition-opacity`}>
        <table className={stackedTable}>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Student ID</th>
              <th scope="col">Field</th>
              <th scope="col">Problem</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <ProblemRow key={`${p.line}-${p.field}-${p.code}`} problem={p} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={data.page}
        pageSize={PROBLEMS_PAGE_SIZE}
        total={data.total}
        onPageChange={setPage}
        noun="problems"
      />
    </section>
  )
}

function ProblemRow({ problem }: { problem: Problem }) {
  return (
    <tr>
      <td data-label="Row">{problem.line}</td>
      <td data-label="Student ID">{problem.student_id || <span className="text-muted">(blank)</span>}</td>
      <td data-label="Field">
        {problem.field ? (FIELD_LABELS[problem.field] ?? problem.field) : <span className="text-muted">(whole row)</span>}
      </td>
      <td data-label="Problem" className="whitespace-normal!">
        <span>
          {problem.message}{' '}
          <span className="ml-1.5 inline-block rounded bg-subtle px-1.5 py-px font-mono text-xs text-muted">
            {problem.code}
          </span>
        </span>
      </td>
    </tr>
  )
}

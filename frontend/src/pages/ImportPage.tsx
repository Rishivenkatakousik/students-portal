import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useId, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { api, ApiError, type ImportResult, type Problem } from '../api'
import { Pagination } from '../components/Pagination'
import { FIELD_LABELS, formatBytes, formatNumber, REQUIRED_COLUMNS } from '../format'

// Mirrors MAX_UPLOAD_MB on the backend, so an oversized file is refused
// before it is uploaded. The server still enforces its own limit.
const MAX_UPLOAD_MB = 10
const PROBLEMS_PAGE_SIZE = 50

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const upload = useMutation({ mutationFn: api.uploadImport })

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
    if (file && !localError) upload.mutate(file)
  }

  return (
    <>
      <h1>Import student results</h1>
      <p className="lead">
        Upload a CSV exported from your spreadsheet. Valid rows are imported; rows with problems are listed below so you
        can fix them.
      </p>

      <div className="import-grid">
        <FileDrop file={file} disabled={upload.isPending} onChoose={choose} />
        <div className="import-side">
          <p className="muted small">
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
            className="button"
            onClick={start}
            disabled={!file || Boolean(localError) || upload.isPending}
          >
            {upload.isPending && <span className="spinner" aria-hidden="true" />}
            {upload.isPending ? 'Importing…' : 'Upload and import'}
          </button>
        </div>
      </div>

      <div aria-live="polite">
        {localError && <ErrorBox title="This file is too large" message={localError} />}
        {upload.isPending && file && (
          <p className="muted">
            Checking {formatBytes(file.size)} of student data. This usually takes a few seconds…
          </p>
        )}
        {upload.isError && <UploadError error={upload.error} onRetry={start} />}
        {upload.isSuccess && <ImportOutcome result={upload.data} />}
      </div>
    </>
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
      className={`dropzone ${dragging ? 'dropzone--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p className="dropzone__title">Drag and drop a CSV file here</p>
      <p className="muted small" id={hintId}>
        or
      </p>
      <button
        type="button"
        className="button button--secondary"
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
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          onChoose(e.target.files?.[0])
          e.target.value = '' // allow choosing the same file again
        }}
      />
      {file && (
        <p className="dropzone__file">
          Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
        </p>
      )}
    </div>
  )
}

function ErrorBox({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert--error" role="alert">
      <strong>{title}</strong>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button--secondary button--small" onClick={onRetry}>
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

function ImportOutcome({ result }: { result: ImportResult }) {
  const { summary } = result
  return (
    <section className="outcome" aria-label="Import result">
      <div className="stat-grid">
        <div className="stat">
          <span className="stat__value">{formatNumber(summary.rows_read)}</span>
          <span className="stat__label">rows read</span>
        </div>
        <div className="stat stat--success">
          <span className="stat__value">{formatNumber(summary.imported)}</span>
          <span className="stat__label">
            imported ({formatNumber(summary.new)} new, {formatNumber(summary.updated)} updated,{' '}
            {formatNumber(summary.unchanged)} unchanged)
          </span>
        </div>
        <div className={`stat ${summary.rejected > 0 ? 'stat--danger' : ''}`}>
          <span className="stat__value">{formatNumber(summary.rejected)}</span>
          <span className="stat__label">rows rejected</span>
        </div>
      </div>

      {summary.extra_columns.length > 0 && (
        <p className="muted small">
          Ignored extra columns: {summary.extra_columns.map((c) => `"${c}"`).join(', ')}.
        </p>
      )}

      {summary.rejected === 0 ? (
        <div className="alert alert--success">
          Every row was imported. <Link to="/students">View students</Link>
        </div>
      ) : (
        <>
          <p className="muted">
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
        <ErrorBox title="Couldn't load this page of problems" message={problems.error.message} onRetry={() => problems.refetch()} />
      )}
      <div className={`table-wrap ${problems.isFetching ? 'is-loading' : ''}`}>
        <table className="table--stack">
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
      <td data-label="Student ID">{problem.student_id || <span className="muted">(blank)</span>}</td>
      <td data-label="Field">
        {problem.field ? (FIELD_LABELS[problem.field] ?? problem.field) : <span className="muted">(whole row)</span>}
      </td>
      <td data-label="Problem" className="wrap">
        <span>
          {problem.message} <span className="code-chip">{problem.code}</span>
        </span>
      </td>
    </tr>
  )
}

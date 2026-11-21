import { ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { ErrorAlert } from '../components/ErrorAlert'
import { FileDrop } from '../components/imports/FileDrop'
import { ImportOutcome } from '../components/imports/ImportOutcome'
import { ProblemsTable } from '../components/imports/ProblemsTable'
import { RecentImports } from '../components/imports/RecentImports'
import { UploadError } from '../components/imports/UploadError'
import { UploadProgress } from '../components/imports/UploadProgress'
import { PageHeader } from '../components/PageHeader'
import { REQUIRED_COLUMNS } from '../constants/fields'
import { useImportLimits, useUploadImport } from '../hooks/queries'
import { formatBytes } from '../utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const upload = useUploadImport(setProgress)
  // From the server; until it loads, only the server's own size check applies.
  const maxUploadMb = useImportLimits().data?.max_upload_mb

  function choose(chosen: File | undefined) {
    if (!chosen) return
    upload.reset() // results on screen belong to the previous file
    setFile(chosen)
    setLocalError(
      maxUploadMb !== undefined && chosen.size > maxUploadMb * 1024 * 1024
        ? `This file is ${formatBytes(chosen.size)}; the limit is ${maxUploadMb} MB. Split it into smaller files and upload them one by one.`
        : null,
    )
  }

  function clear() {
    upload.reset()
    setFile(null)
    setLocalError(null)
  }

  function start() {
    if (file && !localError) {
      setProgress(0)
      upload.mutate(file)
    }
  }

  const showProblems = upload.isSuccess && upload.data.summary.rejected > 0

  return (
    <>
      <PageHeader
        eyebrow="Import · CSV"
        title="Import student results"
        description="Valid rows go straight in. Every rejected row comes back with a plain-language reason you can fix."
      />

      <section aria-label="Upload a file" className="flex flex-wrap gap-4">
        <FileDrop className="flex-[3_1_420px]" disabled={upload.isPending} maxMb={maxUploadMb} onChoose={choose} />

        <Card className="flex-[2_1_320px] gap-5 rounded-3xl p-6 shadow-none">
          {file ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-input bg-muted p-3.5">
              <span
                className="inline-flex size-11 flex-none items-center justify-center rounded-xl bg-background font-mono text-[11px] font-medium text-primary"
                aria-hidden="true"
              >
                CSV
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold" title={file.name}>
                  {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(file.size)} · {upload.isSuccess ? 'imported' : 'ready to import'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={clear}
                disabled={upload.isPending}
                aria-label="Remove file"
              >
                <X />
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-input px-4 py-5 text-center text-muted-foreground">
              No file chosen yet
            </p>
          )}

          <div>
            <p className="mb-2.5 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">{REQUIRED_COLUMNS.length} required columns</strong> · any
              order · extra columns are ignored
            </p>
            <ul className="flex flex-wrap gap-1.5" aria-label="Required columns">
              {REQUIRED_COLUMNS.map((c) => (
                <li key={c}>
                  <Badge variant="outline" className="rounded-lg border-input bg-muted font-mono text-[11.5px] text-foreground/85">
                    {c}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          <Button
            className="mt-auto h-14 rounded-2xl text-base font-semibold"
            onClick={start}
            disabled={!file || Boolean(localError) || upload.isPending}
          >
            {upload.isPending ? 'Importing…' : 'Upload and import'}
            {!upload.isPending && <ArrowRight className="size-[18px]" aria-hidden="true" />}
          </Button>
        </Card>
      </section>

      <div aria-live="polite">
        {localError && <ErrorAlert title="This file is too large" message={localError} />}
        {upload.isPending && file && <UploadProgress file={file} percent={progress} />}
        {upload.isError && <UploadError error={upload.error} onRetry={start} />}
        {upload.isSuccess && <ImportOutcome result={upload.data} />}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-4">
        {showProblems && (
          <ProblemsTable
            className="min-w-0 flex-[999_1_620px]"
            importId={upload.data.summary.id}
            firstPage={upload.data.problems}
          />
        )}
        <RecentImports className={showProblems ? 'flex-[1_1_300px]' : 'mt-6 flex-1'} />
      </div>
    </>
  )
}

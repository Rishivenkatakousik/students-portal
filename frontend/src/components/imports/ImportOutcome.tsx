import { ArrowDown, Check, CircleCheck, Info } from 'lucide-react'
import { Link } from 'react-router'
import type { ImportResult } from '../../api'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDateTime, formatNumber } from '../../utils/format'

const tile = 'gap-5 rounded-3xl p-7 shadow-none'
const bigNumber = 'font-display leading-none font-semibold tracking-[-0.04em]'

function share(part: number, whole: number): string {
  return whole > 0 ? ((part / whole) * 100).toFixed(1) : '0.0'
}

export function ImportOutcome({ result }: { result: ImportResult }) {
  const { summary } = result
  const importedShare = share(summary.imported, summary.rows_read)
  const rejectedShare = share(summary.rejected, summary.rows_read)

  return (
    <section aria-labelledby="result-heading" className="mt-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id="result-heading" className="font-display text-2xl font-semibold tracking-tight">
          Result
        </h2>
        <p className="flex flex-wrap items-center gap-2.5 text-sm text-muted-foreground">
          <Badge variant="success" className="px-3 py-1">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Completed
          </Badge>
          <span className="wrap-anywhere">{summary.filename}</span> · {formatDateTime(summary.started_at)}
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card className={cn(tile, 'flex-[2_1_420px]')}>
          <div className="flex items-center justify-between font-medium text-muted-foreground">
            Imported
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-muted text-primary">
              <Check className="size-[18px]" aria-hidden="true" />
            </span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className={cn(bigNumber, 'text-6xl text-primary sm:text-7xl')}>{formatNumber(summary.imported)}</p>
            <p className="text-muted-foreground">
              {formatNumber(summary.new)} new · {formatNumber(summary.updated)} updated ·{' '}
              {formatNumber(summary.unchanged)} unchanged
            </p>
          </div>
          <div>
            <div
              className="flex h-3 gap-1"
              role="img"
              aria-label={`${importedShare}% of rows imported, ${rejectedShare}% rejected`}
            >
              {summary.imported > 0 && (
                <span className="rounded-full bg-primary" style={{ width: `${importedShare}%` }} />
              )}
              {summary.rejected > 0 && (
                <span className="rounded-full bg-destructive" style={{ width: `${rejectedShare}%` }} />
              )}
            </div>
            <div className="mt-2 flex justify-between text-sm text-muted-foreground" aria-hidden="true">
              <span>{importedShare}% imported</span>
              <span>{rejectedShare}% rejected</span>
            </div>
          </div>
        </Card>

        <Card className={cn(tile, 'flex-[1_1_220px] justify-between')}>
          <span className="font-medium text-muted-foreground">Rows read</span>
          <div>
            <p className={cn(bigNumber, 'text-5xl')}>{formatNumber(summary.rows_read)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Blank lines are skipped</p>
          </div>
        </Card>

        <Card className={cn(tile, 'flex-[1_1_220px] justify-between')}>
          <span className="font-medium text-muted-foreground">Rejected</span>
          <div>
            <p className={cn(bigNumber, 'text-5xl', summary.rejected > 0 && 'text-destructive')}>
              {formatNumber(summary.rejected)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.rejected > 0
                ? `${formatNumber(result.problems.total)} problems to review`
                : 'Nothing to fix'}
            </p>
          </div>
          {summary.rejected > 0 && (
            <a href="#problems-heading" className="inline-flex items-center gap-1.5 self-start font-medium no-underline hover:underline">
              Review rows <ArrowDown className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-5 py-3.5">
        {summary.rejected === 0 ? (
          <>
            <CircleCheck className="size-4 text-success" aria-hidden="true" />
            <span>Every row was imported.</span>
          </>
        ) : (
          <>
            <Info className="size-4 text-info" aria-hidden="true" />
            <span className="flex-[1_1_320px] text-muted-foreground">
              Rejected rows were not imported. Fix them in your spreadsheet and upload the file again: students
              already imported are updated, never duplicated.
            </span>
          </>
        )}
        {summary.extra_columns.length > 0 && (
          <span className="text-muted-foreground">
            Ignored extra {summary.extra_columns.length === 1 ? 'column' : 'columns'}:{' '}
            {summary.extra_columns.map((c) => (
              <code key={c} className="mr-1 rounded-md bg-muted px-1.5 py-0.5 text-foreground">
                {c}
              </code>
            ))}
          </span>
        )}
        <Link to="/students" className="ml-auto font-medium no-underline hover:underline">
          {summary.rejected === 0 ? 'View students' : 'View imported students'} →
        </Link>
      </div>
    </section>
  )
}

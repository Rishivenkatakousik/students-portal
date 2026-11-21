import { api, type ImportSummary } from '../../api'
import { useImports } from '../../hooks/queries'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDateTime, formatNumber } from '../../utils/format'
import { ErrorAlert } from '../ErrorAlert'

export function RecentImports({ className }: { className?: string }) {
  const imports = useImports()

  return (
    <Card className={cn('gap-3 rounded-3xl p-6 shadow-none', className)}>
      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-4 font-display text-xl font-semibold tracking-tight">
          Recent imports
        </h2>
        {imports.isPending ? (
          <div className="grid gap-3" aria-busy="true" aria-label="Loading recent imports">
            <Skeleton className="h-24 rounded-2xl bg-muted" />
            <Skeleton className="h-24 rounded-2xl bg-muted" />
          </div>
        ) : imports.isError ? (
          <ErrorAlert
            title="Couldn't load recent imports"
            message={imports.error.message}
            onRetry={() => imports.refetch()}
            retryLabel="Try again"
          />
        ) : imports.data.total === 0 ? (
          <p className="text-muted-foreground">No files imported yet.</p>
        ) : (
          <>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
              {imports.data.items.map((item) => (
                <ImportCard key={item.id} item={item} />
              ))}
            </ul>
            {imports.data.total > imports.data.items.length && (
              <p className="mt-3 text-sm text-muted-foreground">
                Showing the {imports.data.items.length} most recent of {formatNumber(imports.data.total)} imports.
              </p>
            )}
          </>
        )}
      </section>
    </Card>
  )
}

function ImportCard({ item }: { item: ImportSummary }) {
  const failed = item.status === 'failed'
  const percent = item.rows_read > 0 ? Math.round((item.imported / item.rows_read) * 1000) / 10 : 0
  return (
    <li className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-input bg-muted p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold" title={item.filename}>
            {item.filename}
          </p>
          <p className="text-xs text-muted-foreground">{formatDateTime(item.started_at)}</p>
        </div>
        <Badge variant={failed ? 'danger' : 'success'} className="px-2.5">
          {failed ? 'Not imported' : 'Imported'}
        </Badge>
      </div>
      {failed ? (
        item.file_error && <p className="text-sm text-muted-foreground">{item.file_error}</p>
      ) : (
        <>
          <Progress
            value={percent}
            aria-label={`${percent}% of rows imported`}
            className="h-1.5 bg-input"
          />
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {formatNumber(item.imported)} of {formatNumber(item.rows_read)} imported, {formatNumber(item.rejected)}{' '}
              rejected
            </span>
            {item.rejected > 0 && (
              <a href={api.problemsCsvUrl(item.id)} download className="font-medium no-underline hover:underline">
                Error report ↓
              </a>
            )}
          </div>
        </>
      )}
    </li>
  )
}

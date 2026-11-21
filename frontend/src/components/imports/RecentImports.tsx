import { api, type ImportSummary } from '../../api'
import { useImports } from '../../hooks/queries'
import { badgeFail, badgePass, skeleton, stackedTable, tableWrap } from '../../styles/ui'
import { formatDateTime, formatNumber } from '../../utils/format'
import { ErrorAlert } from '../ErrorAlert'

export function RecentImports() {
  const imports = useImports()

  return (
    <section aria-labelledby="recent-heading" className="mt-12">
      <h2 id="recent-heading">Recent imports</h2>
      {imports.isPending ? (
        <span className={skeleton} style={{ width: 240 }} aria-label="Loading recent imports" />
      ) : imports.isError ? (
        <ErrorAlert
          title="Couldn't load recent imports"
          message={imports.error.message}
          onRetry={() => imports.refetch()}
          retryLabel="Try again"
        />
      ) : imports.data.total === 0 ? (
        <p className="text-muted">No files imported yet.</p>
      ) : (
        <>
          <div className={tableWrap}>
            <table className={stackedTable}>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">File</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Error report</th>
                </tr>
              </thead>
              <tbody>
                {imports.data.items.map((item) => (
                  <HistoryRow key={item.id} item={item} />
                ))}
              </tbody>
            </table>
          </div>
          {imports.data.total > imports.data.items.length && (
            <p className="mt-2 text-sm text-muted">
              Showing the {imports.data.items.length} most recent of {formatNumber(imports.data.total)} imports.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function HistoryRow({ item }: { item: ImportSummary }) {
  const failed = item.status === 'failed'
  return (
    <tr>
      <td data-label="When">{formatDateTime(item.started_at)}</td>
      <td data-label="File">
        {/* Desktop: one line, shortened with "…" (full name on hover). Phone: wraps. */}
        <span className="wrap-anywhere sm:block sm:max-w-56 sm:truncate" title={item.filename}>
          {item.filename}
        </span>
      </td>
      <td data-label="Outcome" className="whitespace-normal!">
        <span className="flex flex-col items-start gap-1">
          <span className={failed ? badgeFail : badgePass}>{failed ? 'Not imported' : 'Imported'}</span>
          {failed && item.file_error && <span className="text-sm text-muted">{item.file_error}</span>}
        </span>
      </td>
      <td data-label="Rows">
        {failed
          ? '—'
          : `${formatNumber(item.imported)} of ${formatNumber(item.rows_read)} imported, ${formatNumber(item.rejected)} rejected`}
      </td>
      <td data-label="Error report">
        {!failed && item.rejected > 0 ? (
          <a href={api.problemsCsvUrl(item.id)} download>
            Download CSV
          </a>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  )
}

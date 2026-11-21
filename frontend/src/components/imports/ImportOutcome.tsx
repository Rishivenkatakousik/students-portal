import { Link } from 'react-router'
import type { ImportResult } from '../../api'
import { alertSuccess } from '../../styles/ui'
import { formatNumber } from '../../utils/format'
import { ProblemsTable } from './ProblemsTable'

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

export function ImportOutcome({ result }: { result: ImportResult }) {
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

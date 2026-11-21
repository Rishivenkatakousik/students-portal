import { formatNumber } from '../format'
import { btnPrimarySmall, btnSecondarySmall } from '../ui'

type Props = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  noun: string // e.g. "students", "problems"
}

/** Page numbers to show: first, last, and the current page's neighbours. */
function pageNumbers(current: number, last: number): (number | 'gap')[] {
  const wanted = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...wanted].sort((a, b) => a - b)
  const result: (number | 'gap')[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push('gap')
    result.push(p)
  })
  return result
}

export function Pagination({ page, pageSize, total, onPageChange, noun }: Props) {
  const last = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav className="mt-3 flex flex-1 flex-wrap items-center justify-between gap-3" aria-label={`${noun} pages`}>
      <p className="text-sm text-muted">
        Showing {formatNumber(first)}–{formatNumber(end)} of {formatNumber(total)} {noun}
      </p>
      {last > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={btnSecondarySmall}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ‹ Previous
          </button>
          {pageNumbers(page, last).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={p === page ? btnPrimarySmall : btnSecondarySmall}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={btnSecondarySmall}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= last}
          >
            Next ›
          </button>
        </div>
      )}
    </nav>
  )
}

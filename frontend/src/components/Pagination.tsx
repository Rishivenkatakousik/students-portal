import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatNumber } from '../utils/format'

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
    <nav className="flex flex-1 flex-wrap items-center justify-between gap-3" aria-label={`${noun} pages`}>
      <p className="text-sm text-muted-foreground">
        Showing {formatNumber(first)}–{formatNumber(end)} of {formatNumber(total)} {noun}
      </p>
      {last > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          {pageNumbers(page, last).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <Button
                key={p}
                variant="ghost"
                className={cn(
                  'h-10 min-w-10 rounded-full px-3',
                  p === page && 'bg-foreground font-semibold text-background hover:bg-foreground/90 hover:text-background',
                )}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon-lg"
            className="rounded-full"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= last}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  )
}

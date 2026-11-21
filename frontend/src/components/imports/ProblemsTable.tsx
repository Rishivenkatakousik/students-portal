import { Download } from 'lucide-react'
import { useState } from 'react'
import { api, type ImportResult, type Problem } from '../../api'
import { FIELD_LABELS } from '../../constants/fields'
import { useImportProblems } from '../../hooks/queries'
import { stackedTable, tableHead } from '../../styles/ui'
import { Badge, type badgeVariants } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatNumber } from '../../utils/format'
import type { VariantProps } from 'class-variance-authority'
import { ErrorAlert } from '../ErrorAlert'
import { Pagination } from '../Pagination'

const PROBLEMS_PAGE_SIZE = 50

type BadgeVariant = VariantProps<typeof badgeVariants>['variant']

/** One colour per kind of problem, so similar rows stand out together. */
const CODE_VARIANTS: Record<string, BadgeVariant> = {
  INVALID_FORMAT: 'info',
  MISSING_REQUIRED: 'warning',
  OUT_OF_RANGE: 'danger',
  DUPLICATE_ID: 'teal',
}

export function ProblemsTable({
  importId,
  firstPage,
  className,
}: {
  importId: number
  firstPage: ImportResult['problems']
  className?: string
}) {
  const [page, setPage] = useState(1)
  const problems = useImportProblems(importId, page, PROBLEMS_PAGE_SIZE, firstPage)
  const data = problems.data ?? firstPage

  return (
    <Card className={cn('gap-0 overflow-hidden rounded-3xl py-0 shadow-none', className)}>
      <section aria-labelledby="problems-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6 pb-4">
          <h2
            id="problems-heading"
            className="flex scroll-mt-6 items-center gap-2.5 font-display text-xl font-semibold tracking-tight"
          >
            Row problems
            <Badge variant="danger" className="px-2.5 font-sans tracking-normal">
              {formatNumber(data.total)}
            </Badge>
          </h2>
          <Button asChild variant="outline" size="lg">
            <a href={api.problemsCsvUrl(importId)} download>
              <Download aria-hidden="true" />
              Download error report (CSV)
            </a>
          </Button>
        </div>
        {problems.isError && (
          <div className="px-6">
            <ErrorAlert
              title="Couldn't load this page of problems"
              message={problems.error.message}
              onRetry={() => problems.refetch()}
              retryLabel="Try again"
            />
          </div>
        )}
        <div className={cn('border-t transition-opacity', problems.isFetching && 'opacity-60')}>
          <Table className={stackedTable}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className={tableHead}>Row</TableHead>
                <TableHead scope="col" className={tableHead}>Student ID</TableHead>
                <TableHead scope="col" className={tableHead}>Field</TableHead>
                <TableHead scope="col" className={tableHead}>Problem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((p) => (
                <ProblemRow key={`${p.line}-${p.field}-${p.code}`} problem={p} />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-6 py-3.5">
          <Pagination
            page={data.page}
            pageSize={PROBLEMS_PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
            noun="problems"
          />
        </div>
      </section>
    </Card>
  )
}

function ProblemRow({ problem }: { problem: Problem }) {
  return (
    <TableRow>
      <TableCell data-label="Row" className="px-4 py-3.5 font-mono text-muted-foreground">
        {problem.line}
      </TableCell>
      <TableCell data-label="Student ID" className="px-4 py-3.5 font-mono">
        {problem.student_id || <span className="font-sans text-muted-foreground italic">blank</span>}
      </TableCell>
      <TableCell data-label="Field" className="px-4 py-3.5">
        {problem.field ? (
          (FIELD_LABELS[problem.field] ?? problem.field)
        ) : (
          <span className="text-muted-foreground italic">whole row</span>
        )}
      </TableCell>
      <TableCell data-label="Problem" className="px-4 py-3.5 whitespace-normal">
        <span>
          {problem.message}{' '}
          <Badge variant={CODE_VARIANTS[problem.code] ?? 'secondary'} className="ml-1.5 rounded-md font-mono text-[11px]">
            {problem.code}
          </Badge>
        </span>
      </TableCell>
    </TableRow>
  )
}

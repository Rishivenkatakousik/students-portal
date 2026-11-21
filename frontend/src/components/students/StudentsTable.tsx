import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { Link } from 'react-router'
import type { StudentListItem, StudentSort } from '../../api'
import { stackedTable, tableHead } from '../../styles/ui'
import { formatPercentage, initials } from '../../utils/format'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export function StudentsTable({
  students,
  loading,
  listSearch,
  sort,
  onSort,
}: {
  students: StudentListItem[]
  loading: boolean
  listSearch: string
  sort: StudentSort
  onSort: (sort: StudentSort) => void
}) {
  const sortable = { sort, onSort }
  return (
    <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
      <Table className={stackedTable}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableHeader label="Student" column="name" {...sortable} />
            <SortableHeader label="Class" column="class" {...sortable} />
            <SortableHeader label="Percentage" column="percentage" firstDescending className="w-[30%]" {...sortable} />
            <TableHead scope="col" className={tableHead}>Grade</TableHead>
            <TableHead scope="col" className={tableHead}>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s) => (
            <TableRow key={s.student_id}>
              <TableCell data-label="Student" className="px-4 py-3">
                <Link
                  to={`/students/${encodeURIComponent(s.student_id)}`}
                  state={{ listSearch }}
                  className="group flex items-center gap-3 no-underline"
                >
                  <span
                    className="inline-flex size-10 flex-none items-center justify-center rounded-full border border-input bg-muted text-[13px] font-semibold text-foreground/85"
                    aria-hidden="true"
                  >
                    {initials(s.full_name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold whitespace-normal group-hover:underline">{s.full_name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{s.student_id}</span>
                  </span>
                </Link>
              </TableCell>
              <TableCell data-label="Class" className="px-4 py-3">
                <span>
                  <span className="font-medium">Class {s.grade_level}</span>{' '}
                  <span className="text-muted-foreground">· Section {s.section}</span>
                </span>
              </TableCell>
              <TableCell data-label="Percentage" className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-14 font-display text-[15px] font-semibold tabular-nums">
                    {formatPercentage(s.percentage)}
                  </span>
                  <span className="h-1.5 min-w-20 flex-1 rounded-full bg-accent max-sm:hidden" aria-hidden="true">
                    <span
                      className={cn('block h-full rounded-full', s.passed ? 'bg-primary' : 'bg-destructive')}
                      style={{ width: `${Math.min(100, Math.max(0, s.percentage))}%` }}
                    />
                  </span>
                </div>
              </TableCell>
              <TableCell data-label="Grade" className="px-4 py-3">
                <span className="inline-flex size-8 items-center justify-center rounded-[10px] border border-input bg-muted font-display font-bold">
                  {s.grade}
                </span>
              </TableCell>
              <TableCell data-label="Result" className="px-4 py-3">
                <Badge variant={s.passed ? 'success' : 'danger'} className="px-3 py-1 font-semibold">
                  <span className={cn('size-1.5 rounded-full', s.passed ? 'bg-success' : 'bg-destructive')} aria-hidden="true" />
                  {s.passed ? 'Pass' : 'Fail'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

type SortColumn = 'student_id' | 'name' | 'class' | 'percentage'

/** A column header that sorts the list; clicking again reverses the order. */
function SortableHeader({
  label,
  column,
  firstDescending = false,
  className,
  sort,
  onSort,
}: {
  label: string
  column: SortColumn
  firstDescending?: boolean // e.g. percentage: highest first is the useful start
  className?: string
  sort: StudentSort
  onSort: (sort: StudentSort) => void
}) {
  const active = sort.replace('-', '') === column
  const descending = sort.startsWith('-')
  const ascending: StudentSort = column
  const reversed = `-${column}` as StudentSort
  const next = active ? (descending ? ascending : reversed) : firstDescending ? reversed : ascending
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp
  return (
    <TableHead
      scope="col"
      className={cn(tableHead, className)}
      aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}
    >
      <button
        type="button"
        className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 uppercase hover:text-foreground',
          active && 'text-foreground',
        )}
        onClick={() => onSort(next)}
      >
        {label}
        <Icon className={cn('size-3.5', !active && 'opacity-50')} aria-hidden="true" />
        <span className="sr-only">, sort {next.startsWith('-') ? 'descending' : 'ascending'}</span>
      </button>
    </TableHead>
  )
}

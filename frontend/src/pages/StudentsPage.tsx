import { SearchX, Upload, Users, X } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { SearchBox } from '../components/students/SearchBox'
import { SkeletonTable } from '../components/students/SkeletonTable'
import { StudentsTable } from '../components/students/StudentsTable'
import { useStudents } from '../hooks/queries'
import {
  CLASSES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZES,
  SECTIONS,
  SORT_OPTIONS,
  useStudentListParams,
  type ListParams,
} from '../hooks/useStudentListParams'
import { formatNumber } from '../utils/format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ALL = 'all' // Select items can't use "" as a value
const filterTrigger = 'h-12 min-w-40 rounded-[14px] border-input bg-muted px-4 data-[size=default]:h-12 dark:bg-muted dark:hover:bg-accent'

export function StudentsPage() {
  const { search, params, update, clear } = useStudentListParams()
  const filtered = Boolean(params.q || params.grade_level || params.section)
  const students = useStudents(params)

  return (
    <>
      <PageHeader
        eyebrow={
          <span aria-live="polite">
            {/* While a new search loads, the dimmed rows are the previous results:
                don't pair their count with the new search. */}
            {students.isPending
              ? 'Loading…'
              : students.isPlaceholderData
                ? 'Searching…'
                : students.isError
                  ? 'Students'
                  : `${formatNumber(students.data.total)} ${students.data.total === 1 ? 'student' : 'students'}${filtered ? ' match' : ''}`}
          </span>
        }
        title="Students"
        description="Search by name or ID, narrow by class, and open anyone's report."
        actions={
          <Button asChild variant="outline" size="lg" className="h-12 rounded-[14px] px-5">
            <Link to="/import">
              <Upload aria-hidden="true" />
              Import CSV
            </Link>
          </Button>
        }
      />

      <Card className="mb-4 flex-row flex-wrap gap-2 rounded-[22px] p-2.5 shadow-none">
        <SearchBox value={params.q} onSearch={(q) => update({ q }, { replace: true })} />
        <Select
          value={params.grade_level ? String(params.grade_level) : ALL}
          onValueChange={(v) => update({ class: v === ALL ? undefined : v })}
        >
          <SelectTrigger className={filterTrigger} aria-label="Class">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All classes</SelectItem>
            {CLASSES.map((c) => (
              <SelectItem key={c} value={String(c)}>
                Class {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.section ?? ALL}
          onValueChange={(v) => update({ section: v === ALL ? undefined : v })}
        >
          <SelectTrigger className={filterTrigger} aria-label="Section">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sections</SelectItem>
            {SECTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                Section {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.sort}
          onValueChange={(v) => update({ sort: v === DEFAULT_SORT ? undefined : v })}
        >
          <SelectTrigger className={`${filterTrigger} min-w-52`} aria-label="Sort by">
            <span className="text-muted-foreground">Sort ·</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="ghost" className="h-12 rounded-[14px] px-4" onClick={clear}>
            <X aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </Card>

      {students.isPending ? (
        <Card className="overflow-hidden rounded-3xl py-0 shadow-none">
          <SkeletonTable rows={8} />
        </Card>
      ) : students.isError ? (
        <ErrorAlert title="Couldn't load students" message={students.error.message} onRetry={() => students.refetch()} />
      ) : students.data.total === 0 && !filtered ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          action={
            <Button asChild size="lg">
              <Link to="/import">Import a file</Link>
            </Button>
          }
        >
          Import a CSV of student results to see them here.
        </EmptyState>
      ) : students.data.total === 0 ? (
        <EmptyState
          icon={SearchX}
          title={
            <>
              No students match{params.q ? ` "${params.q}"` : ''}
              {filterDescription(params)}
            </>
          }
          action={
            <Button variant="outline" size="lg" onClick={clear}>
              Clear search and filters
            </Button>
          }
        >
          {params.q
            ? 'Check the spelling, or search by part of a name or student ID.'
            : 'No students are in this class and section.'}
        </EmptyState>
      ) : students.data.items.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={`Page ${params.page} is empty`}
          action={
            <Button variant="outline" size="lg" onClick={() => update({ page: undefined })}>
              Go to the first page
            </Button>
          }
        >
          There are only {formatNumber(students.data.total)} matching students.
        </EmptyState>
      ) : (
        <Card className="gap-0 overflow-hidden rounded-3xl py-0 shadow-none">
          <StudentsTable
            students={students.data.items}
            loading={students.isFetching}
            listSearch={search.toString()}
            sort={params.sort}
            onSort={(sort) => update({ sort: sort === DEFAULT_SORT ? undefined : sort })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-3.5">
            <Pagination
              page={params.page}
              pageSize={params.page_size}
              total={students.data.total}
              onPageChange={(page) => {
                update({ page: page === 1 ? undefined : page })
                window.scrollTo({ top: 0 })
              }}
              noun="students"
            />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span id="rows-per-page">Rows per page</span>
              <Select
                value={String(params.page_size)}
                onValueChange={(v) => update({ size: Number(v) === DEFAULT_PAGE_SIZE ? undefined : v })}
              >
                <SelectTrigger
                  className="h-10 rounded-xl border-input bg-muted text-foreground dark:bg-muted"
                  aria-labelledby="rows-per-page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}

/** " in Class 9, Section B" for the active filters, or "" when none. */
function filterDescription({ grade_level, section }: ListParams): string {
  const parts = [grade_level && `Class ${grade_level}`, section && `Section ${section}`].filter(Boolean)
  return parts.length ? ` in ${parts.join(', ')}` : ''
}

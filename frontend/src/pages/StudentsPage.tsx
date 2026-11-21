import { Link } from 'react-router'
import { ErrorAlert } from '../components/ErrorAlert'
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
import { btnPrimary, btnSecondary, control, stateCard, stateText } from '../styles/ui'
import { formatNumber } from '../utils/format'

export function StudentsPage() {
  const { search, params, update, clear } = useStudentListParams()
  const filtered = Boolean(params.q || params.grade_level || params.section)
  const students = useStudents(params)

  return (
    <>
      <h1>Students</h1>
      <div className="my-4 flex flex-wrap items-center gap-3">
        <SearchBox value={params.q} onSearch={(q) => update({ q }, { replace: true })} />
        <label>
          <span className="sr-only">Class</span>
          <select className={control} value={params.grade_level ?? ''} onChange={(e) => update({ class: e.target.value })}>
            <option value="">All classes</option>
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Section</span>
          <select className={control} value={params.section ?? ''} onChange={(e) => update({ section: e.target.value })}>
            <option value="">All sections</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:hidden">
          <span className="sr-only">Sort by</span>
          <select
            className={control}
            value={params.sort}
            onChange={(e) => update({ sort: e.target.value === DEFAULT_SORT ? undefined : e.target.value })}
          >
            {SORT_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                Sort: {label}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <button type="button" className={btnSecondary} onClick={clear}>
            Clear filters
          </button>
        )}
      </div>

      {students.isPending ? (
        <SkeletonTable rows={8} />
      ) : students.isError ? (
        <ErrorAlert title="Couldn't load students" message={students.error.message} onRetry={() => students.refetch()} />
      ) : students.data.total === 0 && !filtered ? (
        <div className={stateCard}>
          <h2>No students yet</h2>
          <p className={stateText}>Import a CSV of student results to see them here.</p>
          <Link to="/import" className={btnPrimary}>
            Import a file
          </Link>
        </div>
      ) : students.data.total === 0 ? (
        <div className={stateCard}>
          <h2>
            No students match{params.q ? ` "${params.q}"` : ''}
            {filterDescription(params)}
          </h2>
          <p className={stateText}>
            {params.q
              ? 'Check the spelling, or search by part of a name or student ID.'
              : 'No students are in this class and section.'}
          </p>
          <button type="button" className={btnSecondary} onClick={clear}>
            Clear search and filters
          </button>
        </div>
      ) : students.data.items.length === 0 ? (
        <div className={stateCard}>
          <h2>Page {params.page} is empty</h2>
          <p className={stateText}>There are only {formatNumber(students.data.total)} matching students.</p>
          <button type="button" className={btnSecondary} onClick={() => update({ page: undefined })}>
            Go to the first page
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-muted" aria-live="polite">
            {/* While a new search loads, the dimmed rows are the previous results:
                don't pair their count with the new search. */}
            {students.isPlaceholderData
              ? 'Searching…'
              : `${formatNumber(students.data.total)} ${students.data.total === 1 ? 'student' : 'students'}${filtered ? ' match' : ''}`}
          </p>
          <StudentsTable
            students={students.data.items}
            loading={students.isFetching}
            listSearch={search.toString()}
            sort={params.sort}
            onSort={(sort) => update({ sort: sort === DEFAULT_SORT ? undefined : sort })}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
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
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <span>Rows per page</span>
              <select
                className={control}
                value={params.page_size}
                onChange={(e) =>
                  update({ size: Number(e.target.value) === DEFAULT_PAGE_SIZE ? undefined : e.target.value })
                }
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </>
  )
}

/** " in Class 9, Section B" for the active filters, or "" when none. */
function filterDescription({ grade_level, section }: ListParams): string {
  const parts = [grade_level && `Class ${grade_level}`, section && `Section ${section}`].filter(Boolean)
  return parts.length ? ` in ${parts.join(', ')}` : ''
}

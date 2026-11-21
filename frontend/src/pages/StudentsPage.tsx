import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, type StudentListItem } from '../api'
import { Pagination } from '../components/Pagination'
import { formatNumber, formatPercentage } from '../format'
import { useDebouncedValue } from '../hooks'
import { alertError, badgeFail, badgePass, btnPrimary, btnSecondary, btnSecondarySmall, control, skeleton, stackedTable, stateCard, stateText, table, tableWrap } from '../ui'

const PAGE_SIZES = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25
const CLASSES = Array.from({ length: 12 }, (_, i) => i + 1)
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F']
const SEARCH_DELAY_MS = 300

type ListParams = {
  q: string
  grade_level?: number
  section?: string
  page: number
  page_size: number
}

/** Read the list state from the URL, ignoring anything invalid. */
function readParams(search: URLSearchParams): ListParams {
  const int = (name: string) => {
    const value = Number(search.get(name))
    return Number.isInteger(value) ? value : undefined
  }
  const gradeLevel = int('class')
  const section = search.get('section')?.toUpperCase()
  const page = int('page')
  const size = int('size')
  return {
    q: (search.get('q') ?? '').trim(),
    grade_level: gradeLevel && CLASSES.includes(gradeLevel) ? gradeLevel : undefined,
    section: section && SECTIONS.includes(section) ? section : undefined,
    page: page && page > 0 ? page : 1,
    page_size: size && PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
  }
}

export function StudentsPage() {
  const [search, setSearch] = useSearchParams()
  const params = readParams(search)
  const filtered = Boolean(params.q || params.grade_level || params.section)

  /** Change URL params; anything other than the page number resets to page 1. */
  function update(changes: Record<string, string | number | undefined>, options?: { replace?: boolean }) {
    // Build from the address bar, not this render's copy: two quick changes in
    // a row (class, then section) must not overwrite each other. React
    // Router's functional update would not help here; it also passes this
    // render's params rather than queueing like React's setState.
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    if (!('page' in changes)) next.delete('page')
    setSearch(next, options)
  }

  const students = useQuery({
    queryKey: ['students', params],
    queryFn: () => api.students(params),
    placeholderData: keepPreviousData,
  })

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
        {filtered && (
          <button type="button" className={btnSecondary} onClick={() => setSearch(new URLSearchParams())}>
            Clear filters
          </button>
        )}
      </div>

      {students.isPending ? (
        <SkeletonTable rows={8} />
      ) : students.isError ? (
        <div className={alertError} role="alert">
          <strong>Couldn't load students</strong>
          <p className="mt-1">{students.error.message}</p>
          <button type="button" className={`${btnSecondarySmall} mt-3`} onClick={() => students.refetch()}>
            Retry
          </button>
        </div>
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
          <button type="button" className={btnSecondary} onClick={() => setSearch(new URLSearchParams())}>
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
          <StudentsTable students={students.data.items} loading={students.isFetching} listSearch={search.toString()} />
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

function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, SEARCH_DELAY_MS)
  const id = useId()

  // Typing -> URL, once the user pauses.
  useEffect(() => {
    if (debounced.trim() !== value) onSearch(debounced.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to new input
  }, [debounced])

  // URL -> box, when it changes from outside (Back button, "Clear filters").
  useEffect(() => {
    setText((current) => (current.trim() === value ? current : value))
  }, [value])

  return (
    <div className="flex-[1_1_260px]">
      <label htmlFor={id} className="sr-only">
        Search by name or student ID
      </label>
      <input
        id={id}
        type="search"
        className={`${control} w-full`}
        placeholder="Search by name or student ID"
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}

function StudentsTable({
  students,
  loading,
  listSearch,
}: {
  students: StudentListItem[]
  loading: boolean
  listSearch: string
}) {
  return (
    <div className={`${tableWrap} ${loading ? 'opacity-60' : ''} transition-opacity`} aria-busy={loading}>
      <table className={stackedTable}>
        <thead>
          <tr>
            <th scope="col">Student ID</th>
            <th scope="col">Name</th>
            <th scope="col">Class</th>
            <th scope="col">Section</th>
            <th scope="col">Percentage</th>
            <th scope="col">Grade</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.student_id}>
              <td data-label="Student ID">{s.student_id}</td>
              <td data-label="Name">
                <Link
                  to={`/students/${encodeURIComponent(s.student_id)}`}
                  state={{ listSearch }}
                  className="font-semibold no-underline hover:underline"
                >
                  {s.full_name}
                </Link>
              </td>
              <td data-label="Class">{s.grade_level}</td>
              <td data-label="Section">{s.section}</td>
              <td data-label="Percentage">{formatPercentage(s.percentage)}</td>
              <td data-label="Grade">{s.grade}</td>
              <td data-label="Result">
                <span className={s.passed ? badgePass : badgeFail}>{s.passed ? 'Pass' : 'Fail'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className={tableWrap} aria-busy="true" aria-label="Loading students">
      <table className={table}>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              {[70, 160, 30, 30, 50, 30, 50].map((width, j) => (
                <td key={j}>
                  <span className={skeleton} style={{ width }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

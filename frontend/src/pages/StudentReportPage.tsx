import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, ApiError, type GradingScheme, type StudentReport } from '../api'
import { formatDate, formatPercentage } from '../format'
import { alertError, btnPrimary, btnSecondary, btnSecondarySmall, card, stateCard, stateText, table, tableWrap } from '../ui'

const APP_TITLE = 'Results Portal'
const reportGrid = 'mb-7 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'

/** 58 -> "58", 51.7 -> "51.7", 285.125 -> "285.125" (no float noise). */
function formatMark(value: number): string {
  return String(Number(value.toFixed(3)))
}

function initials(name: string): string {
  const words = name.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)
  const letters = [words[0], words.length > 1 ? words[words.length - 1] : undefined]
    .filter((w): w is string => Boolean(w))
    .map((w) => Array.from(w)[0].toUpperCase())
  return letters.join('')
}

export function StudentReportPage() {
  const { studentId = '' } = useParams()
  const location = useLocation()
  // The list passes its query string along, so "Back" returns to the same
  // search, filters and page. Opened directly, it goes to the full list.
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch
  const backTo = listSearch ? `/students?${listSearch}` : '/students'

  const report = useQuery({ queryKey: ['student', studentId], queryFn: () => api.student(studentId) })
  const scheme = useQuery({ queryKey: ['grading-scheme'], queryFn: api.gradingScheme, staleTime: Infinity })

  useEffect(() => {
    // Also names the PDF when the report is printed or saved.
    document.title = report.data ? `${report.data.full_name} (${report.data.student_id}) - ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = APP_TITLE
    }
  }, [report.data])

  const back = (
    <Link to={backTo} className="mb-4 inline-block font-semibold no-underline hover:underline print:hidden">
      ‹ Back to students
    </Link>
  )

  if (report.isPending) {
    return (
      <>
        {back}
        <h1 className="sr-only">Student report</h1>
        <div className={reportGrid} aria-busy="true" aria-label="Loading report">
          <div className="min-h-[150px] rounded-xl border border-line bg-subtle" />
          <div className="min-h-[150px] rounded-xl border border-line bg-subtle" />
        </div>
      </>
    )
  }

  if (report.isError) {
    const notFound = report.error instanceof ApiError && report.error.status === 404
    return (
      <>
        {back}
        {!notFound && <h1 className="sr-only">Student report</h1>}
        {notFound ? (
          <div className={stateCard}>
            <h1>Student not found</h1>
            <p className={stateText}>
              There is no student with ID "{studentId}". It may have been mistyped, or the student hasn't been imported
              yet.
            </p>
            <Link to={backTo} className={btnPrimary}>
              Back to students
            </Link>
          </div>
        ) : (
          <div className={alertError} role="alert">
            <strong>Couldn't load this report</strong>
            <p className="mt-1">{report.error.message}</p>
            <button type="button" className={`${btnSecondarySmall} mt-3`} onClick={() => report.refetch()}>
              Retry
            </button>
          </div>
        )}
      </>
    )
  }

  const student = report.data
  return (
    <>
      {back}
      <div className={reportGrid}>
        <section className={`${card} flex items-start gap-4 print:break-inside-avoid`} aria-labelledby="student-name">
          <span
            className="inline-flex size-14 flex-none items-center justify-center rounded-full bg-subtle text-lg font-bold text-muted"
            aria-hidden="true"
          >
            {initials(student.full_name)}
          </span>
          <div className="min-w-0 text-muted [&>p]:wrap-anywhere">
            <h1 id="student-name" className="mb-1 text-ink wrap-anywhere">
              {student.full_name}
            </h1>
            <p>
              {student.student_id} · Class {student.grade_level}, Section {student.section}
            </p>
            <p>{student.email}</p>
            <p>
              Date of birth: {formatDate(student.date_of_birth)} (age {student.age})
            </p>
          </div>
        </section>
        <OverallCard student={student} scheme={scheme.data} />
      </div>

      <section aria-labelledby="marks-heading">
        <h2 id="marks-heading">Marks by subject</h2>
        <MarksTable student={student} passMark={scheme.data?.subject_pass_mark} />
      </section>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        {scheme.data && <SchemeNote scheme={scheme.data} />}
        <button type="button" className={`${btnSecondary} print:hidden`} onClick={() => window.print()}>
          Print report
        </button>
      </div>
    </>
  )
}

function failReasons(student: StudentReport, scheme: GradingScheme | undefined): string[] {
  if (student.passed) return []
  const reasons: string[] = []
  if (scheme && student.percentage < scheme.pass_percentage) {
    reasons.push(`Overall below ${scheme.pass_percentage}%`)
  }
  if (student.failed_subjects.length > 0) {
    const mark = scheme ? formatMark(scheme.subject_pass_mark) : 'the pass mark'
    reasons.push(`Below ${mark} in ${student.failed_subjects.join(', ')}`)
  }
  return reasons.length ? reasons : ['Did not meet the pass requirements']
}

function OverallCard({ student, scheme }: { student: StudentReport; scheme: GradingScheme | undefined }) {
  const reasons = failReasons(student, scheme)
  const tone = student.passed ? 'border-accent-line bg-accent-soft' : 'border-danger-line bg-danger-soft'
  const big = 'text-4xl leading-tight font-extrabold'
  return (
    // Not `card`: its bg-white/border-line would compete with the tint, and
    // Tailwind resolves two conflicting utilities by stylesheet order, not markup order.
    <section
      className={`flex flex-col gap-2 rounded-xl border p-5 shadow-sm print:break-inside-avoid print:shadow-none ${tone}`}
      aria-label="Overall result"
    >
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex flex-col">
          <span className="text-xs text-muted">Overall</span>
          <span className={`${big} ${student.passed ? 'text-accent' : 'text-danger'}`}>
            {formatPercentage(student.percentage)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted">Grade</span>
          <span className={big}>{student.grade}</span>
        </div>
        {/* Solid colours: the result must stand out on its tinted card and on paper. */}
        <span
          className={`ml-auto rounded-full px-4 py-1.5 text-sm font-semibold tracking-wider text-white ${
            student.passed ? 'bg-success' : 'bg-danger'
          }`}
        >
          {student.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <p>
        Total: <strong>{formatMark(student.total)}</strong> / {student.max_total}
      </p>
      {reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-danger">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MarksTable({ student, passMark }: { student: StudentReport; passMark: number | undefined }) {
  // Fixed columns on phones so the bars keep their share instead of shrinking to dots.
  const narrow = 'max-sm:table-fixed max-sm:[&_td]:px-2.5 max-sm:[&_td]:whitespace-normal max-sm:[&_th]:px-2.5 max-sm:[&_th]:whitespace-normal'
  const rowHeader = '[&_tbody_th]:text-[0.95rem] [&_tbody_th]:font-medium [&_tfoot_th]:font-bold'
  return (
    <div className={tableWrap}>
      <table className={`${table} ${narrow} ${rowHeader}`}>
        <thead>
          <tr>
            <th scope="col" className="max-sm:w-[38%]">
              Subject
            </th>
            <th scope="col">Marks (out of 100)</th>
            <th scope="col" className="w-[45%] max-sm:w-[30%]">
              <span className="sr-only">Bar chart</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {student.marks.map((m) => (
            <tr key={m.subject}>
              <th scope="row">{m.label}</th>
              <td>
                <strong>{formatMark(m.mark)}</strong>
                {!m.passed && passMark !== undefined && (
                  <span className="text-sm text-danger max-sm:block"> below pass mark ({formatMark(passMark)})</span>
                )}
              </td>
              <td aria-hidden="true">
                <span className="block h-2.5 overflow-hidden rounded-full bg-subtle">
                  <span
                    className={`block h-full rounded-full ${m.passed ? 'bg-accent' : 'bg-danger'}`}
                    style={{ width: `${Math.min(100, Math.max(0, m.mark))}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-line font-bold">
          <tr>
            <th scope="row">Total</th>
            <td colSpan={2}>
              {formatMark(student.total)} / {student.max_total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function SchemeNote({ scheme }: { scheme: GradingScheme }) {
  const bands = scheme.bands
    .map((b, i) =>
      i === scheme.bands.length - 1
        ? `${b.grade} below ${scheme.bands[i - 1].min_percentage}%`
        : `${b.grade} ${b.min_percentage}%+`,
    )
    .join(' · ')
  return (
    <p className="flex-[1_1_320px] text-sm text-muted">
      <strong>How this is graded:</strong> {bands}. Pass needs {scheme.pass_percentage}% overall and at least{' '}
      {formatMark(scheme.subject_pass_mark)} in every subject. Percentages are rounded to one decimal place.
    </p>
  )
}

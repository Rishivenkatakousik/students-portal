import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { api, ApiError, type GradingScheme, type StudentReport } from '../api'
import { formatDate, formatPercentage } from '../format'

const APP_TITLE = 'Results Portal'

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
    <Link to={backTo} className="back-link no-print">
      ‹ Back to students
    </Link>
  )

  if (report.isPending) {
    return (
      <>
        {back}
        <h1 className="visually-hidden">Student report</h1>
        <div className="report-grid" aria-busy="true" aria-label="Loading report">
          <div className="card report-skeleton" />
          <div className="card report-skeleton" />
        </div>
      </>
    )
  }

  if (report.isError) {
    const notFound = report.error instanceof ApiError && report.error.status === 404
    return (
      <>
        {back}
        {!notFound && <h1 className="visually-hidden">Student report</h1>}
        {notFound ? (
          <div className="state card">
            <h1>Student not found</h1>
            <p>There is no student with ID "{studentId}". It may have been mistyped, or the student hasn't been imported yet.</p>
            <Link to={backTo} className="button">
              Back to students
            </Link>
          </div>
        ) : (
          <div className="alert alert--error" role="alert">
            <strong>Couldn't load this report</strong>
            <p>{report.error.message}</p>
            <button type="button" className="button button--secondary button--small" onClick={() => report.refetch()}>
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
      <div className="report-grid">
        <section className="card report-details" aria-labelledby="student-name">
          <span className="avatar" aria-hidden="true">
            {initials(student.full_name)}
          </span>
          <div>
            <h1 id="student-name">{student.full_name}</h1>
            <p className="muted">
              {student.student_id} · Class {student.grade_level}, Section {student.section}
            </p>
            <p className="muted">{student.email}</p>
            <p className="muted">
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

      <div className="report-footer">
        {scheme.data && <SchemeNote scheme={scheme.data} />}
        <button type="button" className="button button--secondary no-print" onClick={() => window.print()}>
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
  return (
    <section className={`card overall ${student.passed ? 'overall--pass' : 'overall--fail'}`} aria-label="Overall result">
      <div className="overall__numbers">
        <div>
          <span className="overall__label">Overall</span>
          <span className="overall__percentage">{formatPercentage(student.percentage)}</span>
        </div>
        <div>
          <span className="overall__label">Grade</span>
          <span className="overall__grade">{student.grade}</span>
        </div>
        <span className={`badge badge--large ${student.passed ? 'badge--pass' : 'badge--fail'}`}>
          {student.passed ? 'PASS' : 'FAIL'}
        </span>
      </div>
      <p className="overall__total">
        Total: <strong>{formatMark(student.total)}</strong> / {student.max_total}
      </p>
      {reasons.length > 0 && (
        <ul className="overall__reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function MarksTable({ student, passMark }: { student: StudentReport; passMark: number | undefined }) {
  return (
    <div className="table-wrap">
      <table className="marks-table">
        <thead>
          <tr>
            <th scope="col">Subject</th>
            <th scope="col">Marks (out of 100)</th>
            <th scope="col" className="marks-table__bar-col">
              <span className="visually-hidden">Bar chart</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {student.marks.map((m) => (
            <tr key={m.subject} className={m.passed ? '' : 'marks-table__row--fail'}>
              <th scope="row">{m.label}</th>
              <td>
                <strong>{formatMark(m.mark)}</strong>
                {!m.passed && passMark !== undefined && (
                  <span className="fail-note"> below pass mark ({formatMark(passMark)})</span>
                )}
              </td>
              <td className="marks-table__bar-col" aria-hidden="true">
                <span className="bar">
                  <span className="bar__fill" style={{ width: `${Math.min(100, Math.max(0, m.mark))}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td colSpan={2}>
              <strong>{formatMark(student.total)}</strong> / {student.max_total}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function SchemeNote({ scheme }: { scheme: GradingScheme }) {
  const bands = scheme.bands
    .map((b, i) => (i === scheme.bands.length - 1 ? `${b.grade} below ${scheme.bands[i - 1].min_percentage}%` : `${b.grade} ${b.min_percentage}%+`))
    .join(' · ')
  return (
    <p className="muted small scheme-note">
      <strong>How this is graded:</strong> {bands}. Pass needs {scheme.pass_percentage}% overall and at least{' '}
      {formatMark(scheme.subject_pass_mark)} in every subject. Percentages are rounded to one decimal place.
    </p>
  )
}

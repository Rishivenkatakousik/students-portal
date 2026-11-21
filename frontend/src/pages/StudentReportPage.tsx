import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../api'
import { ErrorAlert } from '../components/ErrorAlert'
import { MarksTable } from '../components/students/MarksTable'
import { OverallCard } from '../components/students/OverallCard'
import { SchemeNote } from '../components/students/SchemeNote'
import { useGradingScheme, useStudent } from '../hooks/queries'
import { btnPrimary, btnSecondary, card, stateCard, stateText } from '../styles/ui'
import { formatDate, initials } from '../utils/format'

const APP_TITLE = 'Results Portal'
const reportGrid = 'mb-7 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'

export function StudentReportPage() {
  const { studentId = '' } = useParams()
  const location = useLocation()
  // The list passes its query string along, so "Back" returns to the same
  // search, filters and page. Opened directly, it goes to the full list.
  const listSearch = (location.state as { listSearch?: string } | null)?.listSearch
  const backTo = listSearch ? `/students?${listSearch}` : '/students'

  const report = useStudent(studentId)
  const scheme = useGradingScheme()

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
          <ErrorAlert
            title="Couldn't load this report"
            message={report.error.message}
            onRetry={() => report.refetch()}
          />
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

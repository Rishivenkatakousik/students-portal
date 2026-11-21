import { ChevronLeft, Printer, UserX } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ApiError } from '../api'
import { EmptyState } from '../components/EmptyState'
import { ErrorAlert } from '../components/ErrorAlert'
import { OverallCard } from '../components/students/OverallCard'
import { SchemeNote } from '../components/students/SchemeNote'
import { SubjectMarks } from '../components/students/SubjectMarks'
import { useGradingScheme, useStudent } from '../hooks/queries'
import { formatDate, initials } from '../utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const APP_TITLE = 'Results Portal'

export function StudentReportPage() {
  const { studentId = '' } = useParams()
  const location = useLocation()
  // "Back" returns to the list's search, filters and page when we came from it.
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
    <Button asChild variant="outline" className="h-11 rounded-full pr-4 pl-2.5">
      <Link to={backTo}>
        <ChevronLeft className="size-[18px]" aria-hidden="true" />
        Back to students
      </Link>
    </Button>
  )

  if (report.isPending) {
    return (
      <>
        <div className="mb-6 print:hidden">{back}</div>
        <h1 className="sr-only">Student report</h1>
        <div className="flex flex-wrap gap-4" aria-busy="true" aria-label="Loading report">
          <Skeleton className="h-64 flex-[3_1_480px] rounded-3xl bg-card" />
          <Skeleton className="h-64 flex-[2_1_340px] rounded-3xl bg-card" />
          <Skeleton className="h-56 w-full rounded-3xl bg-card" />
        </div>
      </>
    )
  }

  if (report.isError) {
    const notFound = report.error instanceof ApiError && report.error.status === 404
    return (
      <>
        <div className="mb-6 print:hidden">{back}</div>
        {notFound ? (
          <EmptyState
            icon={UserX}
            heading="h1"
            title="Student not found"
            action={
              <Button asChild size="lg">
                <Link to={backTo}>Back to students</Link>
              </Button>
            }
          >
            There is no student with ID "{studentId}". It may have been mistyped, or the student hasn't been imported
            yet.
          </EmptyState>
        ) : (
          <>
            <h1 className="sr-only">Student report</h1>
            <ErrorAlert
              title="Couldn't load this report"
              message={report.error.message}
              onRetry={() => report.refetch()}
            />
          </>
        )}
      </>
    )
  }

  const student = report.data
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {back}
        <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print report
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4">
          <Card className="flex-[3_1_480px] justify-between gap-7 rounded-3xl p-8 shadow-none print:break-inside-avoid">
            <section aria-labelledby="student-name" className="flex flex-wrap items-center gap-5">
              <span
                className="inline-flex size-20 flex-none items-center justify-center rounded-full border-2 border-primary bg-muted font-display text-[26px] font-semibold"
                aria-hidden="true"
              >
                {initials(student.full_name)}
              </span>
              <div className="min-w-0">
                <h1
                  id="student-name"
                  className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.04em] wrap-anywhere sm:text-5xl"
                >
                  {student.full_name}
                </h1>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="rounded-lg border-input bg-muted px-2.5 py-1 font-mono text-xs">
                    {student.student_id}
                  </Badge>
                  <Badge variant="outline" className="rounded-lg border-input bg-muted px-2.5 py-1 text-xs">
                    Class {student.grade_level} · Section {student.section}
                  </Badge>
                </div>
              </div>
            </section>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 border-t pt-6">
              <div>
                <dt className="text-xs tracking-wider text-muted-foreground uppercase">Email</dt>
                <dd className="mt-1 font-medium wrap-anywhere">{student.email}</dd>
              </div>
              <div>
                <dt className="text-xs tracking-wider text-muted-foreground uppercase">Date of birth</dt>
                <dd className="mt-1 font-medium">
                  {formatDate(student.date_of_birth)}{' '}
                  <span className="font-normal text-muted-foreground">· age {student.age}</span>
                </dd>
              </div>
            </dl>
          </Card>
          <OverallCard className="flex-[2_1_340px]" student={student} scheme={scheme.data} />
        </div>

        <SubjectMarks student={student} passMark={scheme.data?.subject_pass_mark} />

        {scheme.data && <SchemeNote scheme={scheme.data} grade={student.grade} />}
      </div>
    </>
  )
}

import { useParams } from 'react-router'

export function StudentReportPage() {
  const { studentId } = useParams()
  return (
    <>
      <h1>Student {studentId}</h1>
      <p className="lead">Report built in step 10.</p>
    </>
  )
}

import { useState } from 'react'
import { api, type ImportResult, type Problem } from '../../api'
import { FIELD_LABELS } from '../../constants/fields'
import { useImportProblems } from '../../hooks/queries'
import { btnSecondary, stackedTable, tableWrap } from '../../styles/ui'
import { ErrorAlert } from '../ErrorAlert'
import { Pagination } from '../Pagination'

const PROBLEMS_PAGE_SIZE = 50

export function ProblemsTable({ importId, firstPage }: { importId: number; firstPage: ImportResult['problems'] }) {
  const [page, setPage] = useState(1)
  const problems = useImportProblems(importId, page, PROBLEMS_PAGE_SIZE, firstPage)
  const data = problems.data ?? firstPage

  return (
    <section aria-labelledby="problems-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 id="problems-heading" className="mb-0">
          Row problems
        </h2>
        <a href={api.problemsCsvUrl(importId)} download className={btnSecondary}>
          Download error report (CSV)
        </a>
      </div>
      {problems.isError && (
        <ErrorAlert
          title="Couldn't load this page of problems"
          message={problems.error.message}
          onRetry={() => problems.refetch()}
          retryLabel="Try again"
        />
      )}
      <div className={`${tableWrap} ${problems.isFetching ? 'opacity-60' : ''} transition-opacity`}>
        <table className={stackedTable}>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Student ID</th>
              <th scope="col">Field</th>
              <th scope="col">Problem</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <ProblemRow key={`${p.line}-${p.field}-${p.code}`} problem={p} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={data.page}
        pageSize={PROBLEMS_PAGE_SIZE}
        total={data.total}
        onPageChange={setPage}
        noun="problems"
      />
    </section>
  )
}

function ProblemRow({ problem }: { problem: Problem }) {
  return (
    <tr>
      <td data-label="Row">{problem.line}</td>
      <td data-label="Student ID">{problem.student_id || <span className="text-muted">(blank)</span>}</td>
      <td data-label="Field">
        {problem.field ? (FIELD_LABELS[problem.field] ?? problem.field) : <span className="text-muted">(whole row)</span>}
      </td>
      <td data-label="Problem" className="whitespace-normal!">
        <span>
          {problem.message}{' '}
          <span className="ml-1.5 inline-block rounded bg-subtle px-1.5 py-px font-mono text-xs text-muted">
            {problem.code}
          </span>
        </span>
      </td>
    </tr>
  )
}

import { Link } from 'react-router'
import type { StudentListItem, StudentSort } from '../../api'
import { badgeFail, badgePass, stackedTable, tableWrap } from '../../styles/ui'
import { formatPercentage } from '../../utils/format'

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
    <div className={`${tableWrap} ${loading ? 'opacity-60' : ''} transition-opacity`} aria-busy={loading}>
      <table className={stackedTable}>
        <thead>
          <tr>
            <SortableHeader label="Student ID" column="student_id" {...sortable} />
            <SortableHeader label="Name" column="name" {...sortable} />
            <SortableHeader label="Class" column="class" {...sortable} />
            <th scope="col">Section</th>
            <SortableHeader label="Percentage" column="percentage" firstDescending {...sortable} />
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

type SortColumn = 'student_id' | 'name' | 'class' | 'percentage'

/** A column header that sorts the list; clicking again reverses the order. */
function SortableHeader({
  label,
  column,
  firstDescending = false,
  sort,
  onSort,
}: {
  label: string
  column: SortColumn
  firstDescending?: boolean // e.g. percentage: highest first is the useful start
  sort: StudentSort
  onSort: (sort: StudentSort) => void
}) {
  const active = sort.replace('-', '') === column
  const descending = sort.startsWith('-')
  const ascending: StudentSort = column
  const reversed = `-${column}` as StudentSort
  const next = active ? (descending ? ascending : reversed) : firstDescending ? reversed : ascending
  return (
    <th scope="col" aria-sort={active ? (descending ? 'descending' : 'ascending') : 'none'}>
      <button
        type="button"
        className={`inline-flex cursor-pointer items-center gap-1 uppercase hover:text-ink ${active ? 'text-ink' : ''}`}
        onClick={() => onSort(next)}
      >
        {label}
        <span aria-hidden="true" className={active ? '' : 'opacity-30'}>
          {active && descending ? '▼' : '▲'}
        </span>
        <span className="sr-only">, sort {next.startsWith('-') ? 'descending' : 'ascending'}</span>
      </button>
    </th>
  )
}

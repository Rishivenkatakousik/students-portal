import type { StudentReport } from '../../api'
import { table, tableWrap } from '../../styles/ui'
import { formatMark } from '../../utils/format'

export function MarksTable({ student, passMark }: { student: StudentReport; passMark: number | undefined }) {
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

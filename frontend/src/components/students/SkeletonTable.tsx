import { skeleton, table, tableWrap } from '../../styles/ui'

export function SkeletonTable({ rows }: { rows: number }) {
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

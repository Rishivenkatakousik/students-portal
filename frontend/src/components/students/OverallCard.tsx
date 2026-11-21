import type { GradingScheme, StudentReport } from '../../api'
import { formatMark, formatPercentage } from '../../utils/format'

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

export function OverallCard({ student, scheme }: { student: StudentReport; scheme: GradingScheme | undefined }) {
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

import { Check, X } from 'lucide-react'
import type { GradingScheme, StudentReport } from '../../api'
import { formatMark, formatPercentage } from '../../utils/format'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

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

export function OverallCard({
  student,
  scheme,
  className,
}: {
  student: StudentReport
  scheme: GradingScheme | undefined
  className?: string
}) {
  const reasons = failReasons(student, scheme)
  const filled = (Math.min(100, Math.max(0, student.percentage)) / 100) * RING_LENGTH
  return (
    <Card
      className={cn('flex-row flex-wrap items-center gap-7 rounded-3xl p-8 shadow-none print:break-inside-avoid', className)}
      aria-label="Overall result"
      role="region"
    >
      <svg
        viewBox="0 0 120 120"
        className="size-[148px] flex-none"
        role="img"
        aria-label={`Overall ${formatPercentage(student.percentage)}`}
      >
        <circle cx="60" cy="60" r={RING_RADIUS} fill="none" strokeWidth="10" className="stroke-accent" />
        <circle
          cx="60"
          cy="60"
          r={RING_RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${RING_LENGTH}`}
          transform="rotate(-90 60 60)"
          className={student.passed ? 'stroke-primary' : 'stroke-destructive'}
        />
        <text x="60" y="60" textAnchor="middle" className="fill-foreground font-display text-[22px] font-semibold">
          {formatPercentage(student.percentage)}
        </text>
        <text x="60" y="77" textAnchor="middle" className="fill-muted-foreground font-sans text-[9px]">
          overall
        </text>
      </svg>

      <div className="flex min-w-36 flex-1 flex-col gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 self-start rounded-full px-3.5 py-1 text-[13px] font-bold tracking-[0.08em] text-background',
            student.passed ? 'bg-success' : 'bg-destructive',
          )}
        >
          {student.passed ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <X className="size-3.5" strokeWidth={3} aria-hidden="true" />}
          {student.passed ? 'PASS' : 'FAIL'}
        </span>
        <p className="flex items-baseline gap-2.5">
          <span className="font-display text-6xl leading-none font-bold tracking-[-0.04em]">{student.grade}</span>
          <span className="text-muted-foreground">grade</span>
        </p>
        <p className="text-muted-foreground">
          Total <strong className="font-semibold text-foreground">{formatMark(student.total)}</strong> /{' '}
          {student.max_total}
        </p>
      </div>

      {reasons.length > 0 && (
        <ul className="w-full list-disc rounded-2xl bg-destructive/10 py-3 pr-4 pl-8 text-sm text-destructive">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

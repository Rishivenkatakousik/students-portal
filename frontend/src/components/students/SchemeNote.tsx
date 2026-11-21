import type { GradingScheme } from '../../api'
import { formatMark } from '../../utils/format'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function SchemeNote({ scheme, grade }: { scheme: GradingScheme; grade: string }) {
  const bands = scheme.bands.map((b, i) => ({
    grade: b.grade,
    label:
      i === scheme.bands.length - 1
        ? `${b.grade} · below ${scheme.bands[i - 1].min_percentage}%`
        : `${b.grade} · ${b.min_percentage}%+`,
  }))
  return (
    <Card className="flex-row flex-wrap items-center gap-x-5 gap-y-3 rounded-[22px] px-6 py-4 shadow-none print:break-inside-avoid">
      <h2 className="font-semibold">How this is graded</h2>
      <ul className="flex flex-wrap gap-1.5" aria-label="Grade bands">
        {bands.map((b) => (
          <li
            key={b.grade}
            className={cn(
              'rounded-full px-3 py-1 text-[13px]',
              b.grade === grade ? 'bg-primary font-semibold text-primary-foreground' : 'border border-input text-foreground/85',
            )}
            aria-current={b.grade === grade ? 'true' : undefined}
          >
            {b.label}
          </li>
        ))}
      </ul>
      <p className="flex-[1_1_280px] text-muted-foreground">
        Pass needs {scheme.pass_percentage}% overall and at least {formatMark(scheme.subject_pass_mark)} in every
        subject. Percentages are rounded to one decimal place.
      </p>
    </Card>
  )
}

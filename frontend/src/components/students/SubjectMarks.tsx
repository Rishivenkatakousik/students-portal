import type { StudentReport } from '../../api'
import { formatMark } from '../../utils/format'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** One tile per subject: the mark, and a bar with a tick at the pass mark. */
export function SubjectMarks({ student, passMark }: { student: StudentReport; passMark: number | undefined }) {
  return (
    <Card className="gap-5 rounded-3xl p-7 shadow-none print:break-inside-avoid">
      <section aria-labelledby="marks-heading">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="marks-heading" className="font-display text-2xl font-semibold tracking-tight">
            Marks by subject
          </h2>
          <p className="text-sm text-muted-foreground">
            Out of 100{passMark !== undefined && ` · the tick on each bar is the pass mark (${formatMark(passMark)})`}
          </p>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {student.marks.map((m) => (
            <li key={m.subject} className="flex flex-col gap-3.5 rounded-[20px] border border-input bg-muted p-5">
              <span className="font-medium text-muted-foreground">{m.label}</span>
              <span className="font-display text-[44px] leading-none font-semibold tracking-[-0.04em]">
                {formatMark(m.mark)}
                <span className="sr-only"> out of 100</span>
              </span>
              <span className="relative block h-2 rounded-full bg-input" aria-hidden="true">
                <span
                  className={cn('block h-full rounded-full', m.passed ? 'bg-primary' : 'bg-destructive')}
                  style={{ width: `${Math.min(100, Math.max(0, m.mark))}%` }}
                />
                {passMark !== undefined && (
                  <span
                    className="absolute -top-[3px] h-3.5 w-0.5 rounded-sm bg-muted-foreground"
                    style={{ left: `${passMark}%` }}
                  />
                )}
              </span>
              {!m.passed && passMark !== undefined && (
                <span className="text-sm text-destructive">Below pass mark ({formatMark(passMark)})</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Card>
  )
}

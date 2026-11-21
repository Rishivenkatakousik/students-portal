import type { GradingScheme } from '../../api'
import { formatMark } from '../../utils/format'

export function SchemeNote({ scheme }: { scheme: GradingScheme }) {
  const bands = scheme.bands
    .map((b, i) =>
      i === scheme.bands.length - 1
        ? `${b.grade} below ${scheme.bands[i - 1].min_percentage}%`
        : `${b.grade} ${b.min_percentage}%+`,
    )
    .join(' · ')
  return (
    <p className="flex-[1_1_320px] text-sm text-muted">
      <strong>How this is graded:</strong> {bands}. Pass needs {scheme.pass_percentage}% overall and at least{' '}
      {formatMark(scheme.subject_pass_mark)} in every subject. Percentages are rounded to one decimal place.
    </p>
  )
}

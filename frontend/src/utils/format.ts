// Display helpers shared by the pages.

const numberFormat = new Intl.NumberFormat('en-IN')

export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

/** "2012-03-14" -> "14 March 2012", without timezone shifts. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "21 Nov 2026, 16:05" in the viewer's own time zone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Readable names for CSV columns, as an administrator would say them. */
export const FIELD_LABELS: Record<string, string> = {
  student_id: 'Student ID',
  full_name: 'Name',
  email: 'Email',
  date_of_birth: 'Date of birth',
  grade_level: 'Class',
  section: 'Section',
  maths: 'Maths',
  science: 'Science',
  english: 'English',
  social_studies: 'Social studies',
  second_language: 'Second language',
}

export const REQUIRED_COLUMNS = Object.keys(FIELD_LABELS)

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

/** 58 -> "58", 51.7 -> "51.7", 285.125 -> "285.125" (no float noise). */
export function formatMark(value: number): string {
  return String(Number(value.toFixed(3)))
}

export function initials(name: string): string {
  const words = name.replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean)
  const letters = [words[0], words.length > 1 ? words[words.length - 1] : undefined]
    .filter((w): w is string => Boolean(w))
    .map((w) => Array.from(w)[0].toUpperCase())
  return letters.join('')
}

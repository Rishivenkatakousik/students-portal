// The students list state (search, filters, sort, paging), kept in the URL.

import { useSearchParams } from 'react-router'
import type { StudentSort } from '../api'

export const PAGE_SIZES = [10, 25, 50, 100]
export const DEFAULT_PAGE_SIZE = 25
export const CLASSES = Array.from({ length: 12 }, (_, i) => i + 1)
export const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F']
export const DEFAULT_SORT: StudentSort = 'student_id'
const SORTS: StudentSort[] = ['student_id', '-student_id', 'name', '-name', 'class', '-class', 'percentage', '-percentage']
// Options for the phone sort menu (table headers are hidden on narrow screens).
export const SORT_OPTIONS: [StudentSort, string][] = [
  ['student_id', 'Student ID'],
  ['name', 'Name A–Z'],
  ['-name', 'Name Z–A'],
  ['class', 'Class (lowest first)'],
  ['-class', 'Class (highest first)'],
  ['-percentage', 'Percentage (highest first)'],
  ['percentage', 'Percentage (lowest first)'],
]

export type ListParams = {
  q: string
  grade_level?: number
  section?: string
  page: number
  page_size: number
  sort: StudentSort
}

/** Read the list state from the URL, ignoring anything invalid. */
function readParams(search: URLSearchParams): ListParams {
  const int = (name: string) => {
    const value = Number(search.get(name))
    return Number.isInteger(value) ? value : undefined
  }
  const gradeLevel = int('class')
  const section = search.get('section')?.toUpperCase()
  const page = int('page')
  const size = int('size')
  return {
    q: (search.get('q') ?? '').trim(),
    grade_level: gradeLevel && CLASSES.includes(gradeLevel) ? gradeLevel : undefined,
    section: section && SECTIONS.includes(section) ? section : undefined,
    page: page && page > 0 ? page : 1,
    page_size: size && PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: SORTS.find((s) => s === search.get('sort')) ?? DEFAULT_SORT,
  }
}

export function useStudentListParams() {
  const [search, setSearch] = useSearchParams()
  const params = readParams(search)

  /** Change URL params; anything other than the page number resets to page 1. */
  function update(changes: Record<string, string | number | undefined>, options?: { replace?: boolean }) {
    // Build from the address bar, not this render's copy: two quick changes in
    // a row (class, then section) must not overwrite each other. React
    // Router's functional update would not help here; it also passes this
    // render's params rather than queueing like React's setState.
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key)
      else next.set(key, String(value))
    }
    if (!('page' in changes)) next.delete('page')
    setSearch(next, options)
  }

  /** Drop search, filters, sort and paging. */
  function clear() {
    setSearch(new URLSearchParams())
  }

  return { search, params, update, clear }
}

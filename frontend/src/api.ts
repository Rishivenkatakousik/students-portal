// Typed client for the backend API. Types mirror backend/app/schemas.py.

export type Page<T> = {
  items: T[]
  total: number
  page: number
  page_size: number
}

export type ImportSummary = {
  id: number
  filename: string
  file_size: number
  status: 'completed' | 'failed'
  file_error_code: string | null
  file_error: string | null
  rows_read: number
  imported: number
  new: number
  updated: number
  unchanged: number
  rejected: number
  extra_columns: string[]
  started_at: string
  finished_at: string | null
}

export type Problem = {
  line: number
  student_id: string
  field: string | null // null = the whole row
  code: string
  message: string
  raw_value: string | null
}

export type ImportResult = {
  summary: ImportSummary
  problems: Page<Problem>
}

export type StudentListItem = {
  student_id: string
  full_name: string
  grade_level: number
  section: string
  percentage: number
  grade: string
  passed: boolean
}

export type SubjectMark = {
  subject: string
  label: string
  mark: number
  passed: boolean
}

export type StudentReport = {
  student_id: string
  full_name: string
  email: string
  date_of_birth: string // YYYY-MM-DD
  age: number
  grade_level: number
  section: string
  marks: SubjectMark[]
  total: number
  max_total: number
  percentage: number
  grade: string
  passed: boolean
  failed_subjects: string[]
  updated_at: string
}

export type GradingScheme = {
  bands: { grade: string; min_percentage: number }[]
  pass_percentage: number
  subject_pass_mark: number
  max_total: number
}

export type StudentSort =
  | 'student_id' | '-student_id' | 'name' | '-name'
  | 'class' | '-class' | 'percentage' | '-percentage'

export type StudentQuery = {
  q?: string
  grade_level?: number
  section?: string
  page?: number
  page_size?: number
  sort?: StudentSort
}

/** Any failed request. `message` is always safe to show to the administrator. */
export class ApiError extends Error {
  readonly status: number // 0 = the server could not be reached
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    // Backend errors look like {"error": {"code", "message"}}; anything else
    // (e.g. a proxy's HTML error page) gets a generic message.
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? `The server returned an unexpected error (${response.status}). Please try again.`,
    )
  }
  return body as T
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const api = {
  uploadImport(file: File): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)
    return request('/api/imports', { method: 'POST', body: form })
  },

  importProblems(importId: number, page: number, pageSize: number): Promise<Page<Problem>> {
    return request(`/api/imports/${importId}/problems${query({ page, page_size: pageSize })}`)
  },

  students(params: StudentQuery): Promise<Page<StudentListItem>> {
    return request(`/api/students${query(params)}`)
  },

  student(studentId: string): Promise<StudentReport> {
    return request(`/api/students/${encodeURIComponent(studentId)}`)
  },

  gradingScheme(): Promise<GradingScheme> {
    return request('/api/grading-scheme')
  },
}

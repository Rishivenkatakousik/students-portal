// Typed client for the backend API. Types mirror backend/app/schemas.py.

import axios from 'axios'

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

const http = axios.create({ baseURL: '/api', timeout: 30_000 })

// Turn every failure into an ApiError the pages can show as-is.
http.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)))

function toApiError(error: unknown): ApiError {
  if (!axios.isAxiosError(error)) {
    return new ApiError(0, 'UNKNOWN_ERROR', 'Something went wrong. Please try again.')
  }
  const response = error.response
  if (!response) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError(0, 'TIMEOUT', 'The server took too long to answer. Please try again.')
    }
    return new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  }
  // Backend errors look like {"error": {"code", "message"}}; anything else
  // (e.g. a proxy's HTML error page) gets a generic message.
  const body = response.data as { error?: { code?: string; message?: string } } | string | null
  const apiError = typeof body === 'object' && body !== null ? body.error : undefined
  if (!apiError && [502, 503, 504].includes(response.status)) {
    // A proxy answered because the backend is down or restarting.
    return new ApiError(
      response.status,
      'SERVER_UNAVAILABLE',
      'The server is not responding right now. Please try again in a moment.',
    )
  }
  return new ApiError(
    response.status,
    apiError?.code ?? `HTTP_${response.status}`,
    apiError?.message ?? `The server returned an unexpected error (${response.status}). Please try again.`,
  )
}

/** Drop empty filters so the URL only carries what is set. */
function cleanParams(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
}

/** Upload progress, 0-100. Reaches 100 before the server has finished checking rows. */
export type ProgressHandler = (percent: number) => void

export const api = {
  async uploadImport(file: File, onProgress?: ProgressHandler): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await http.post<ImportResult>('/imports', form, {
      timeout: 5 * 60_000, // large files on slow connections
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
      },
    })
    return data
  },

  async importProblems(importId: number, page: number, pageSize: number): Promise<Page<Problem>> {
    const { data } = await http.get<Page<Problem>>(`/imports/${importId}/problems`, {
      params: { page, page_size: pageSize },
    })
    return data
  },

  async students(params: StudentQuery): Promise<Page<StudentListItem>> {
    const { data } = await http.get<Page<StudentListItem>>('/students', { params: cleanParams(params) })
    return data
  },

  async student(studentId: string): Promise<StudentReport> {
    const { data } = await http.get<StudentReport>(`/students/${encodeURIComponent(studentId)}`)
    return data
  },

  async gradingScheme(): Promise<GradingScheme> {
    const { data } = await http.get<GradingScheme>('/grading-scheme')
    return data
  },
}

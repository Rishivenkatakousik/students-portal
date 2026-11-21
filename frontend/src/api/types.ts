// Response and request types. They mirror backend/app/schemas/.

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

export type ImportLimits = {
  max_upload_mb: number
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

/** Upload progress, 0-100. Reaches 100 before the server has finished checking rows. */
export type ProgressHandler = (percent: number) => void

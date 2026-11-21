// Typed client for the backend API.

import { cleanParams, http } from './client'
import type {
  GradingScheme,
  ImportResult,
  ImportSummary,
  Page,
  Problem,
  ProgressHandler,
  StudentListItem,
  StudentQuery,
  StudentReport,
} from './types'

export { ApiError } from './client'
export type * from './types'

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

  async imports(page = 1, pageSize = 10): Promise<Page<ImportSummary>> {
    const { data } = await http.get<Page<ImportSummary>>('/imports', { params: { page, page_size: pageSize } })
    return data
  },

  /** A plain link target: the browser downloads the CSV itself. */
  problemsCsvUrl(importId: number): string {
    return `/api/imports/${importId}/problems.csv`
  },
}

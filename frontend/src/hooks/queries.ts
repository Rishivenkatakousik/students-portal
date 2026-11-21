// Every server query and mutation, with the cache keys they share.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ImportResult, type ProgressHandler, type StudentQuery } from '../api'

export const queryKeys = {
  allStudents: ['students'] as const,
  students: (params: StudentQuery) => ['students', params] as const,
  allStudentReports: ['student'] as const,
  student: (studentId: string) => ['student', studentId] as const,
  gradingScheme: ['grading-scheme'] as const,
  imports: ['imports'] as const,
  importProblems: (importId: number, page: number) => ['import-problems', importId, page] as const,
}

export function useStudents(params: StudentQuery) {
  return useQuery({
    queryKey: queryKeys.students(params),
    queryFn: () => api.students(params),
    placeholderData: keepPreviousData,
  })
}

export function useStudent(studentId: string) {
  return useQuery({ queryKey: queryKeys.student(studentId), queryFn: () => api.student(studentId) })
}

export function useGradingScheme() {
  return useQuery({ queryKey: queryKeys.gradingScheme, queryFn: api.gradingScheme, staleTime: Infinity })
}

export function useImports() {
  return useQuery({ queryKey: queryKeys.imports, queryFn: () => api.imports(1, 10) })
}

export function useImportProblems(
  importId: number,
  page: number,
  pageSize: number,
  firstPage: ImportResult['problems'],
) {
  return useQuery({
    queryKey: queryKeys.importProblems(importId, page),
    queryFn: () => api.importProblems(importId, page, pageSize),
    initialData: page === 1 ? firstPage : undefined,
    placeholderData: keepPreviousData,
  })
}

export function useUploadImport(onProgress: ProgressHandler) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (chosen: File) => api.uploadImport(chosen, onProgress),
    // Cached lists and reports are now out of date; without this, "View
    // students" right after an import could still show "No students yet".
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.allStudents }),
        queryClient.invalidateQueries({ queryKey: queryKeys.allStudentReports }),
        queryClient.invalidateQueries({ queryKey: queryKeys.imports }),
      ]),
  })
}

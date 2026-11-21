// The axios instance every request goes through. Failures always reject with ApiError.

import axios from 'axios'

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

export const http = axios.create({ baseURL: '/api', timeout: 30_000 })

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
export function cleanParams(params: Record<string, string | number | undefined>) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
}

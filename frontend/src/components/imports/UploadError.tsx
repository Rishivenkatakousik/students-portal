import { ApiError } from '../../api'
import { ErrorAlert } from '../ErrorAlert'

export function UploadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const apiError = error instanceof ApiError ? error : null
  const status = apiError?.status ?? 500
  if (status >= 400 && status < 500) {
    // The file itself is the problem: retrying the same file won't help.
    return <ErrorAlert title="This file can't be imported" message={error.message} />
  }
  const unreachable = status === 0 || apiError?.code === 'SERVER_UNAVAILABLE'
  const title = unreachable ? "Couldn't reach the server" : 'The import did not finish'
  return <ErrorAlert title={title} message={error.message} onRetry={onRetry} retryLabel="Try again" />
}

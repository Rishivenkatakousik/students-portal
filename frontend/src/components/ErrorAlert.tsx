import { alertError, btnSecondarySmall } from '../styles/ui'

type Props = {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

/** An error box with an optional retry button. */
export function ErrorAlert({ title, message, onRetry, retryLabel = 'Retry' }: Props) {
  return (
    <div className={alertError} role="alert">
      <strong>{title}</strong>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button type="button" className={`${btnSecondarySmall} mt-3`} onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

import { CircleAlert, RotateCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

type Props = {
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

/** An error box with an optional retry button. */
export function ErrorAlert({ title, message, onRetry, retryLabel = 'Retry' }: Props) {
  return (
    <Alert variant="destructive" className="my-4 rounded-2xl border-destructive/30 bg-destructive/10">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2 text-foreground" onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            {retryLabel}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

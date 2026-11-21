import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={MapPinOff}
      heading="h1"
      title="Page not found"
      action={
        <Button asChild size="lg">
          <Link to="/students">Go to students</Link>
        </Button>
      }
    >
      There is nothing at this address.
    </EmptyState>
  )
}

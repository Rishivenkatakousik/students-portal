import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'

type Props = {
  icon: LucideIcon
  title: ReactNode
  heading?: 'h1' | 'h2'
  children?: ReactNode // one line of help
  action?: ReactNode
}

/** A centred message for "nothing here" states, with one way forward. */
export function EmptyState({ icon: Icon, title, heading: Heading = 'h2', children, action }: Props) {
  return (
    <Card className="items-center gap-0 rounded-3xl px-6 py-14 text-center shadow-none">
      <span className="mb-5 inline-flex size-14 items-center justify-center rounded-full border bg-muted text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <Heading className="font-display text-2xl font-semibold tracking-tight">{title}</Heading>
      {children && <p className="mt-2 max-w-md text-muted-foreground">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  )
}

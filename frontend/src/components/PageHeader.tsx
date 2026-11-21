import type { ReactNode } from 'react'

type Props = {
  eyebrow?: ReactNode // small pill above the title
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

/** The big title block at the top of a page. */
export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6 print:hidden">
      <div className="max-w-3xl">
        {eyebrow && (
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 font-mono text-xs text-foreground/85">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-6xl">{title}</h1>
        {description && <p className="mt-3 text-lg text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  )
}

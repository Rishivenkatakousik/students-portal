import { Skeleton } from '@/components/ui/skeleton'

export function SkeletonTable({ rows }: { rows: number }) {
  return (
    <div className="divide-y" aria-busy="true" aria-label="Loading students">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5">
          <Skeleton className="size-10 rounded-full bg-muted" />
          <div className="flex w-48 flex-col gap-2">
            <Skeleton className="h-3.5 w-36 bg-muted" />
            <Skeleton className="h-3 w-20 bg-muted" />
          </div>
          <Skeleton className="h-3.5 w-28 bg-muted max-sm:hidden" />
          <Skeleton className="h-2 flex-1 bg-muted max-sm:hidden" />
          <Skeleton className="size-8 rounded-[10px] bg-muted" />
          <Skeleton className="h-6 w-16 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  )
}

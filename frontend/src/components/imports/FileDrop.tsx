import { CloudUpload } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FileDrop({
  disabled,
  maxMb,
  onChoose,
  className,
}: {
  disabled: boolean
  maxMb?: number // the server's limit, once known
  onChoose: (file: File | undefined) => void
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hintId = useId()

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!disabled) onChoose(event.dataTransfer.files[0])
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-3xl border-[1.5px] border-dashed px-6 py-11 text-center transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-input bg-card',
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <span className="mb-2 inline-flex size-16 items-center justify-center rounded-full border bg-muted text-primary">
        <CloudUpload className="size-7" aria-hidden="true" />
      </span>
      <p className="font-display text-xl font-semibold tracking-tight">Drop your CSV here</p>
      <p className="text-muted-foreground" id={hintId}>
        Exported from Excel or Google Sheets{maxMb !== undefined && ` · up to ${maxMb} MB`}
      </p>
      <Button
        variant="outline"
        size="lg"
        className="mt-3"
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Browse files
      </Button>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          onChoose(e.target.files?.[0])
          e.target.value = '' // allow choosing the same file again
        }}
      />
    </div>
  )
}

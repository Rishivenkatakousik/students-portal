import { useId, useRef, useState, type DragEvent } from 'react'
import { btnSecondary } from '../../styles/ui'
import { formatBytes } from '../../utils/format'

export function FileDrop({
  file,
  disabled,
  onChoose,
}: {
  file: File | null
  disabled: boolean
  onChoose: (file: File | undefined) => void
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
      className={`rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
        dragging ? 'border-accent bg-accent-soft' : 'border-line bg-white'
      }`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <p className="font-semibold">Drag and drop a CSV file here</p>
      <p className="mt-1 mb-2 text-sm text-muted" id={hintId}>
        or
      </p>
      <button
        type="button"
        className={btnSecondary}
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-describedby={hintId}
      >
        Choose file
      </button>
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
      {file && (
        <p className="mt-4 wrap-anywhere">
          Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
        </p>
      )}
    </div>
  )
}

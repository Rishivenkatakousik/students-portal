import { formatBytes } from '../../utils/format'

export function UploadProgress({ file, percent }: { file: File; percent: number }) {
  const uploading = percent < 100
  return (
    <div className="my-4 max-w-md">
      <p className="mb-1.5 text-sm text-muted">
        {uploading
          ? `Uploading ${formatBytes(file.size)}… ${percent}%`
          : 'Uploaded. Checking every row; this usually takes a few seconds…'}
      </p>
      <div
        className="h-2 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

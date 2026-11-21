import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '../../utils/format'

// Measured: a full 10 MB file (~140,000 rows) takes about 19 s to check and save.
const SECONDS_PER_MB = 2

/** Seconds since `running` last became true; 0 while it is false. */
function useElapsedSeconds(running: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(timer)
      setElapsed(0)
    }
  }, [running])
  return elapsed
}

export function UploadProgress({ file, percent }: { file: File; percent: number }) {
  const uploading = percent < 100
  const elapsed = useElapsedSeconds(!uploading)
  const expected = Math.ceil((file.size / (1024 * 1024)) * SECONDS_PER_MB)
  const estimate = expected <= 3 ? 'this takes a few seconds' : `a file this size takes about ${expected} seconds`
  return (
    <Card className="my-4 gap-3 rounded-3xl px-6 py-5 shadow-none">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        {uploading
          ? `Uploading ${formatBytes(file.size)}… ${percent}%`
          : `Uploaded. Checking every row; ${estimate}…${elapsed > 0 ? ` (${elapsed} s so far)` : ''}`}
      </p>
      <Progress value={percent} aria-label="Upload progress" className="h-2.5 bg-muted" />
    </Card>
  )
}

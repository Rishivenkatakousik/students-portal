import { LoaderCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '../../utils/format'

export function UploadProgress({ file, percent }: { file: File; percent: number }) {
  const uploading = percent < 100
  return (
    <Card className="my-4 gap-3 rounded-3xl px-6 py-5 shadow-none">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        {uploading
          ? `Uploading ${formatBytes(file.size)}… ${percent}%`
          : 'Uploaded. Checking every row; this usually takes a few seconds…'}
      </p>
      <Progress value={percent} aria-label="Upload progress" className="h-2.5 bg-muted" />
    </Card>
  )
}

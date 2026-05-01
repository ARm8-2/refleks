import { Loader2 } from 'lucide-react'

type LoadingProps = {
  label?: string
}

export function Loading({ label = 'Loading...' }: LoadingProps) {
  return (
    <div className="flex h-full w-full items-center justify-center text-surface-muted-foreground">
      <div className="inline-flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}

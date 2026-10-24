import { LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Inhalte werden geladen …' }: { label?: string }) {
  return (
    <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" />
      {label}
    </div>
  )
}

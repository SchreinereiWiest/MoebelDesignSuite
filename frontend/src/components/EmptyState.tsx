import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.4rem] border border-dashed border-border bg-card/45 px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-foreground">
        <Icon className="size-5" strokeWidth={1.7} />
      </div>
      <h3 className="font-display text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

import { BookmarkPlus, CircleAlert, Clock3, Eye, LockKeyhole, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ImageSummary } from '@/types'

export function ImageCard({
  image,
  onOpen,
  onSave,
  compact = false,
}: {
  image: ImageSummary
  onOpen?: () => void
  onSave?: () => void
  compact?: boolean
}) {
  const isProcessing = image.status !== 'READY' && image.status !== 'FAILED'
  const title = image.title || image.filename.replace(/\.[^.]+$/, '')

  return (
    <article className="group min-w-0">
      <div
        className={cn(
          'relative overflow-hidden rounded-[1.15rem] bg-secondary',
          compact ? 'aspect-[4/3]' : 'aspect-[4/5]',
        )}
      >
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-zoom-in"
          onClick={onOpen}
          aria-label={`${title} öffnen`}
        />
        {image.thumbnailUrl ? (
          <img
            src={image.thumbnailUrl}
            alt={title}
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,#ddd3c2,#c8bdab_45%,#b5a894)] px-5 text-center text-foreground/70">
            {image.status === 'FAILED' ? (
              <CircleAlert className="size-6" />
            ) : (
              <Clock3 className="size-6" />
            )}
            <span className="text-xs font-medium">
              {image.status === 'FAILED' ? 'Verarbeitung fehlgeschlagen' : 'Vorschau wird erstellt'}
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
          <VisibilityBadge visibility={image.visibility} />
          <div className="flex gap-2 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={onOpen}
              className="grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur hover:bg-white"
              aria-label="Details anzeigen"
            >
              <Eye className="size-4" />
            </button>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="grid size-9 place-items-center rounded-full bg-white/90 text-foreground shadow-sm backdrop-blur hover:bg-white"
                aria-label="Auf Moodboard merken"
              >
                <BookmarkPlus className="size-4" />
              </button>
            )}
          </div>
        </div>

        {isProcessing && (
          <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-black/10">
            <span className="block h-full w-1/2 animate-[loading-bar_1.5s_ease-in-out_infinite] bg-accent" />
          </div>
        )}
      </div>
      <div className="px-1 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {image.tags.slice(0, 3).map((tag) => tag.name).join(' · ') || 'Noch nicht kategorisiert'}
            </p>
          </div>
          <span className="mt-0.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
        </div>
      </div>
    </article>
  )
}

function VisibilityBadge({ visibility }: { visibility: ImageSummary['visibility'] }) {
  const content = {
    PRIVATE: { icon: LockKeyhole, label: 'Privat' },
    RESTRICTED: { icon: Users, label: 'Beratung' },
    PUBLIC: { icon: Eye, label: 'Freigegeben' },
  }[visibility]
  const Icon = content.icon
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[0.68rem] font-medium text-white backdrop-blur">
      <Icon className="size-3" />
      {content.label}
    </span>
  )
}

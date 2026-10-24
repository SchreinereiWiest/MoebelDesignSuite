import { ArrowUpRight, Images } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CollectionSummary } from '@/types'

export function MoodboardCard({ board }: { board: CollectionSummary }) {
  return (
    <Link
      to={`/moodboards/${board.id}`}
      className="group block rounded-[1.25rem] border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(49,42,32,0.09)]"
    >
      <div className="grid aspect-[1.55/1] grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-[0.9rem] bg-secondary">
        {board.covers.length ? (
          board.covers.map((cover, index) =>
            cover.url ? (
              <img
                key={cover.imageId}
                src={cover.url}
                alt=""
                className={`size-full object-cover ${index === 0 && board.covers.length < 3 ? 'row-span-2' : ''}`}
              />
            ) : (
              <div key={cover.imageId} className="bg-muted" />
            ),
          )
        ) : (
          <div className="col-span-2 row-span-2 grid place-items-center">
            <Images className="size-7 text-muted-foreground/60" />
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-4 px-1 pb-1 pt-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{board.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {board.itemCount} {board.itemCount === 1 ? 'Inspiration' : 'Inspirationen'} · aktualisiert{' '}
            {new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short' }).format(
              new Date(board.updatedAt),
            )}
          </p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border transition group-hover:bg-foreground group-hover:text-white">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  )
}

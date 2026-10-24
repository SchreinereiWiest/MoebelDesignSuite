import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clipboard,
  FileText,
  MessageSquareText,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { getCollection, listCollections, updateCollectionItem } from '@/lib/api'
import { CATEGORY_LABELS } from '@/lib/design-options'
import { cn } from '@/lib/utils'
import type { CollectionDetail, CollectionSummary, MoodboardItem, TagCategory } from '@/types'

export function ConsultationPage() {
  const [boards, setBoards] = useState<CollectionSummary[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState('')
  const [board, setBoard] = useState<CollectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void listCollections({ limit: 100 })
      .then((response) => {
        setBoards(response.data)
        if (response.data[0]) setSelectedBoardId(response.data[0].id)
        else setLoading(false)
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : 'Projekte konnten nicht geladen werden.')
        setLoading(false)
      })
  }, [])

  const loadBoard = useCallback(async () => {
    if (!selectedBoardId) return
    setLoading(true)
    setError(null)
    try {
      setBoard(await getCollection(selectedBoardId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Projekt konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [selectedBoardId])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  function patchLocal(itemId: string, patch: Partial<MoodboardItem>) {
    setBoard((current) => current ? { ...current, items: current.items.map((item) => item.id === itemId ? { ...item, ...patch } : item) } : current)
  }

  async function patchItem(itemId: string, patch: Pick<Partial<MoodboardItem>, 'rating' | 'note'>) {
    patchLocal(itemId, patch)
    try {
      await updateCollectionItem(selectedBoardId, itemId, patch)
      window.dispatchEvent(new CustomEvent('collections-changed'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bewertung konnte nicht gespeichert werden.')
      void loadBoard()
    }
  }

  const liked = board?.items.filter((item) => item.rating === 'LIKE').length ?? 0
  const disliked = board?.items.filter((item) => item.rating === 'DISLIKE').length ?? 0
  const open = (board?.items.length ?? 0) - liked - disliked
  const briefing = useMemo(() => createBriefing(board), [board])

  return (
    <div className="mx-auto max-w-[90rem]">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="eyebrow">Gemeinsame Gestaltung</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Beratung, die Wünsche sichtbar macht.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Bewertet Inspirationen gemeinsam, haltet Details fest und verdichtet die Auswahl zu einem klaren Designbriefing.</p>
        </div>
        {board && board.items.length > 0 && <Button onClick={() => setBriefingOpen(true)}><Sparkles className="size-4" />Designbriefing erstellen</Button>}
      </div>

      {boards.length > 0 && (
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-secondary"><MessageSquareText className="size-4" /></span><div><p className="text-xs font-semibold">Aktuelles Kundenprojekt</p><p className="text-[0.68rem] text-muted-foreground">Alle Änderungen werden sofort gespeichert.</p></div></div>
          <select value={selectedBoardId} onChange={(event) => setSelectedBoardId(event.target.value)} className="field sm:ml-auto sm:max-w-sm">
            {boards.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <LoadingState label="Beratungsprojekt wird vorbereitet …" /> : error && !board ? (
        <EmptyState icon={MessageSquareText} title="Beratung nicht verfügbar" description={error} action={<Button onClick={() => void loadBoard()}>Erneut laden</Button>} />
      ) : !boards.length ? (
        <div className="mt-8"><EmptyState icon={MessageSquareText} title="Noch kein Kundenprojekt" description="Lege zuerst ein Moodboard an und füge passende Inspirationen hinzu. Danach kannst du es hier gemeinsam bewerten." action={<Button asChild><Link to="/moodboards">Moodboard anlegen</Link></Button>} /></div>
      ) : board ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric icon={ThumbsUp} value={liked} label="Gefällt" tone="green" />
            <Metric icon={ThumbsDown} value={disliked} label="Nicht passend" tone="red" />
            <Metric icon={MessageSquareText} value={open} label="Noch offen" tone="neutral" />
          </section>

          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

          <section className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-4"><div><p className="eyebrow">Gemeinsame Auswahl</p><h2 className="mt-1 font-display text-3xl">Was passt zum Projekt?</h2></div><span className="text-xs text-muted-foreground">{board.items.length} Inspirationen</span></div>
            {board.items.length ? (
              <div className="space-y-4">
                {board.items.map((item) => (
                  <article key={item.id} className="grid overflow-hidden rounded-[1.25rem] border border-border bg-card sm:grid-cols-[13rem_1fr_auto]">
                    <img src={item.image.url} alt={item.image.title || item.image.filename} className="aspect-[4/3] size-full object-cover sm:aspect-auto" />
                    <div className="p-5">
                      <h3 className="font-semibold">{item.image.title || item.image.filename}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">{item.image.tags.slice(0, 5).map((tag) => <span key={tag.slug} className="rounded-full bg-muted px-2.5 py-1 text-[0.68rem] text-muted-foreground">{tag.name}</span>)}</div>
                      <label className="mt-4 block"><span className="field-label">Wunsch, Detail oder Kommentar</span><textarea value={item.note || ''} onChange={(event) => patchLocal(item.id, { note: event.target.value })} onBlur={(event) => void patchItem(item.id, { note: event.target.value.trim() || null })} className="field min-h-20 resize-none" placeholder="Was soll übernommen oder vermieden werden?" /></label>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border p-4 sm:flex-col sm:justify-center sm:border-l sm:border-t-0">
                      <RatingButton active={item.rating === 'LIKE'} icon={ThumbsUp} label="Gefällt" onClick={() => void patchItem(item.id, { rating: item.rating === 'LIKE' ? null : 'LIKE' })} />
                      <RatingButton active={item.rating === 'DISLIKE'} icon={ThumbsDown} label="Nicht passend" negative onClick={() => void patchItem(item.id, { rating: item.rating === 'DISLIKE' ? null : 'DISLIKE' })} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={MessageSquareText} title="Noch keine Bilder zur Bewertung" description="Füge dem Moodboard Inspirationen hinzu und kehre anschließend in die Beratung zurück." action={<Button asChild><Link to={`/moodboards/${board.id}`}>Moodboard öffnen</Link></Button>} />
            )}
          </section>
        </>
      ) : null}

      <Dialog open={briefingOpen} onOpenChange={setBriefingOpen}>
        <DialogContent className="max-h-[88vh] w-[min(44rem,calc(100%-2rem))] overflow-y-auto rounded-[1.5rem] p-7 sm:p-9">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary text-white"><FileText className="size-5" /></span><div><p className="eyebrow">Automatische Zusammenfassung</p><DialogTitle className="mt-1 font-display text-3xl font-normal">Designbriefing</DialogTitle></div></div>
          <DialogDescription className="mt-4 leading-6">Aus Bewertungen, Tags und Notizen dieses Moodboards zusammengestellt. Vor der Weitergabe bitte fachlich prüfen.</DialogDescription>
          <div className="mt-6 whitespace-pre-wrap rounded-xl border border-border bg-muted/45 p-5 text-sm leading-7">{briefing}</div>
          <div className="mt-6 flex justify-end"><Button onClick={() => { void navigator.clipboard.writeText(briefing); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check className="size-4" /> : <Clipboard className="size-4" />}{copied ? 'Kopiert' : 'Briefing kopieren'}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ icon: Icon, value, label, tone }: { icon: typeof ThumbsUp; value: number; label: string; tone: 'green' | 'red' | 'neutral' }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4"><span className={cn('grid size-10 place-items-center rounded-xl', tone === 'green' ? 'bg-green-100 text-green-800' : tone === 'red' ? 'bg-red-100 text-red-800' : 'bg-secondary text-muted-foreground')}><Icon className="size-4" /></span><div><p className="text-xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>
}

function RatingButton({ active, icon: Icon, label, negative = false, onClick }: { active: boolean; icon: typeof ThumbsUp; label: string; negative?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn('inline-flex h-10 min-w-32 items-center justify-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold transition hover:bg-muted', active && (negative ? 'border-[#9e4e3e] bg-[#9e4e3e] text-white hover:bg-[#9e4e3e]' : 'border-primary bg-primary text-white hover:bg-primary'))}><Icon className="size-4" />{label}</button>
}

function createBriefing(board: CollectionDetail | null) {
  if (!board) return ''
  const relevant = board.items.filter((item) => item.rating !== 'DISLIKE')
  const source = relevant.some((item) => item.rating === 'LIKE') ? relevant.filter((item) => item.rating === 'LIKE') : relevant
  const grouped = new Map<TagCategory, Set<string>>()
  source.flatMap((item) => item.image.tags).forEach((tag) => {
    if (tag.category === 'TECHNICAL') return
    if (!grouped.has(tag.category)) grouped.set(tag.category, new Set())
    grouped.get(tag.category)?.add(tag.name)
  })
  const categories = [...grouped.entries()].map(([category, values]) => `${CATEGORY_LABELS[category]}: ${[...values].join(', ')}`)
  const notes = source.map((item) => item.note?.trim()).filter(Boolean)
  return [
    `Projekt: ${board.name}`,
    board.description ? `Ziel: ${board.description}` : null,
    '',
    'GESTALTUNGSRICHTUNG',
    categories.length ? categories.join('\n') : 'Die gestalterischen Merkmale werden im nächsten Gespräch konkretisiert.',
    '',
    'PRÄFERENZEN UND DETAILWÜNSCHE',
    notes.length ? notes.map((note, index) => `${index + 1}. ${note}`).join('\n') : 'Noch keine Detailwünsche notiert.',
    '',
    `Entscheidungsstand: ${board.items.filter((item) => item.rating === 'LIKE').length} positiv bewertet, ${board.items.filter((item) => item.rating === 'DISLIKE').length} ausgeschlossen, ${board.items.filter((item) => !item.rating).length} offen.`,
  ].filter((line) => line !== null).join('\n')
}

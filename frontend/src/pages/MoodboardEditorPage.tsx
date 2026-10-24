import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  BringToFront,
  Check,
  Download,
  Edit3,
  Grid2X2,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  Maximize2,
  Presentation,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AddImagesDialog } from '@/components/AddImagesDialog'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  deleteCollection,
  getCollection,
  removeCollectionItem,
  updateCollection,
  updateCollectionItem,
} from '@/lib/api'
import { VISIBILITY_LABELS } from '@/lib/design-options'
import { cn } from '@/lib/utils'
import type { CollectionDetail, MoodboardItem } from '@/types'

type DragState = {
  itemId: string
  startX: number
  startY: number
  originX: number
  originY: number
}

export function MoodboardEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const boardRef = useRef<CollectionDetail | null>(null)
  const [board, setBoard] = useState<CollectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'canvas' | 'gallery'>('canvas')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const response = await getCollection(id)
      setBoard(response)
      boardRef.current = response
      setEditName(response.name)
      setEditDescription(response.description || '')
      setSelectedItemId((current) => current || response.items[0]?.id || null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboard konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!drag) return
    const activeDrag = drag
    function move(event: PointerEvent) {
      setBoard((current) => {
        if (!current) return current
        const next = {
          ...current,
          items: current.items.map((item) => {
            if (item.id !== activeDrag.itemId) return item
            return {
              ...item,
              x: Math.max(0, Math.min(1050 - (item.width ?? 260), activeDrag.originX + event.clientX - activeDrag.startX)),
              y: Math.max(0, Math.min(570, activeDrag.originY + event.clientY - activeDrag.startY)),
            }
          }),
        }
        boardRef.current = next
        return next
      })
    }
    function end() {
      const item = boardRef.current?.items.find((entry) => entry.id === activeDrag.itemId)
      setDrag(null)
      if (item) void updateCollectionItem(id, item.id, { x: item.x, y: item.y })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
    }
  }, [drag, id])

  function patchLocal(itemId: string, patch: Partial<MoodboardItem>) {
    setBoard((current) => {
      if (!current) return current
      const next = { ...current, items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) }
      boardRef.current = next
      return next
    })
  }

  async function patchItem(itemId: string, patch: Partial<Pick<MoodboardItem, 'width' | 'rotation' | 'zIndex' | 'note' | 'rating'>>) {
    patchLocal(itemId, patch)
    try {
      await updateCollectionItem(id, itemId, patch)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Änderung konnte nicht gespeichert werden.')
      void load()
    }
  }

  async function removeItem(itemId: string) {
    try {
      await removeCollectionItem(id, itemId)
      setSelectedItemId(null)
      await load()
      window.dispatchEvent(new CustomEvent('collections-changed'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bild konnte nicht entfernt werden.')
    }
  }

  async function saveBoard(event: React.FormEvent) {
    event.preventDefault()
    if (!editName.trim()) return
    setSaving(true)
    try {
      await updateCollection(id, { name: editName.trim(), description: editDescription.trim() })
      setEditOpen(false)
      await load()
      window.dispatchEvent(new CustomEvent('collections-changed'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboard konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  async function removeBoard() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    setSaving(true)
    try {
      await deleteCollection(id)
      window.dispatchEvent(new CustomEvent('collections-changed'))
      navigate('/moodboards')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboard konnte nicht gelöscht werden.')
      setSaving(false)
    }
  }

  const selectedItem = board?.items.find((item) => item.id === selectedItemId) || null
  const existingImageIds = useMemo(() => new Set(board?.items.map((item) => item.imageId) || []), [board])
  const hasPrivateImages = board?.items.some((item) => item.image.visibility === 'PRIVATE') ?? false

  if (loading && !board) return <LoadingState label="Moodboard wird geöffnet …" />
  if (!board) return <EmptyState icon={LayoutDashboard} title="Moodboard nicht gefunden" description={error || 'Das angeforderte Konzept existiert nicht mehr.'} action={<Button asChild><Link to="/moodboards">Zur Übersicht</Link></Button>} />

  return (
    <div className="mx-auto max-w-[100rem] print:max-w-none">
      <div className="print:hidden">
        <Link to="/moodboards" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Alle Moodboards</Link>
        <div className="mt-4 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl sm:text-5xl">{board.name}</h1>
              <button onClick={() => setEditOpen(true)} className="grid size-9 place-items-center rounded-full hover:bg-card" aria-label="Moodboard bearbeiten"><Edit3 className="size-4" /></button>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{board.description || 'Noch keine Projektbeschreibung hinterlegt.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex rounded-lg border border-border bg-card p-1">
              <button onClick={() => setMode('canvas')} className={cn('inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold', mode === 'canvas' && 'bg-secondary')}><Maximize2 className="size-3.5" />Pinnwand</button>
              <button onClick={() => setMode('gallery')} className={cn('inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold', mode === 'gallery' && 'bg-secondary')}><Grid2X2 className="size-3.5" />Galerie</button>
            </div>
            <Button variant="outline" onClick={() => window.print()} disabled={hasPrivateImages || !board.items.length} title={hasPrivateImages ? 'Private Bilder müssen vor dem Export freigegeben werden.' : undefined}><Download className="size-4" />Export</Button>
            <Button onClick={() => setAddOpen(true)}><ImagePlus className="size-4" />Bilder hinzufügen</Button>
          </div>
        </div>
        {hasPrivateImages && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <LockKeyhole className="size-4 shrink-0" />Mindestens ein Bild ist privat. Setze die Freigabe auf „Beratung“ oder „Freigegeben“, bevor du das Moodboard präsentierst oder exportierst.
          </div>
        )}
        {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      </div>

      <div className="hidden print:mb-6 print:block">
        <p className="text-xs uppercase tracking-[0.18em]">Wiest Design Suite · Moodboard</p>
        <h1 className="mt-2 font-display text-4xl">{board.name}</h1>
        {board.description && <p className="mt-2 text-sm text-muted-foreground">{board.description}</p>}
      </div>

      {!board.items.length ? (
        <div className="mt-8 print:hidden"><EmptyState icon={ImagePlus} title="Die Pinnwand ist noch frei" description="Füge Inspirationen aus deiner Bibliothek hinzu und ordne sie anschließend frei an." action={<Button onClick={() => setAddOpen(true)}><ImagePlus className="size-4" />Inspirationen auswählen</Button>} /></div>
      ) : mode === 'canvas' ? (
        <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem] print:block">
          <div className="overflow-x-auto rounded-[1.4rem] border border-border bg-[#d9d1c1] p-3 sm:p-5 print:overflow-visible print:border-0 print:bg-white print:p-0">
            <div className="moodboard-canvas relative h-[680px] w-[1050px] overflow-hidden rounded-xl bg-[#f0ede6] shadow-inner print:h-[670px] print:w-full print:shadow-none">
              {board.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    setSelectedItemId(item.id)
                    setDrag({ itemId: item.id, startX: event.clientX, startY: event.clientY, originX: item.x ?? 48, originY: item.y ?? 48 })
                  }}
                  className={cn('absolute cursor-grab touch-none overflow-visible rounded-sm shadow-[0_10px_24px_rgba(45,38,30,0.18)] outline-none transition-shadow active:cursor-grabbing', selectedItemId === item.id && 'ring-2 ring-accent ring-offset-4 ring-offset-[#f0ede6]')}
                  style={{ left: item.x ?? 48, top: item.y ?? 48, width: item.width ?? 260, zIndex: item.zIndex, transform: `rotate(${item.rotation}deg)` }}
                >
                  <img src={item.image.url} alt={item.image.title || item.image.filename} className="block w-full rounded-sm" draggable={false} />
                  {item.rating && <span className={cn('absolute -right-3 -top-3 grid size-8 place-items-center rounded-full text-white shadow-md', item.rating === 'LIKE' ? 'bg-primary' : 'bg-[#9e4e3e]')}>{item.rating === 'LIKE' ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}</span>}
                  {item.note && <span className="absolute -bottom-5 left-4 max-w-[85%] rotate-[-1deg] bg-[#fff4b8] px-3 py-2 text-left text-[0.68rem] leading-4 text-[#4a4229] shadow-md">{item.note}</span>}
                </button>
              ))}
            </div>
          </div>

          <aside className="rounded-[1.25rem] border border-border bg-card p-5 print:hidden">
            {selectedItem ? (
              <>
                <div className="flex items-center gap-3">
                  <img src={selectedItem.image.thumbnailUrl || selectedItem.image.url} alt="" className="size-14 rounded-lg object-cover" />
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{selectedItem.image.title || selectedItem.image.filename}</p><p className="mt-1 text-xs text-muted-foreground">{VISIBILITY_LABELS[selectedItem.image.visibility]}</p></div>
                </div>
                <div className="mt-6 space-y-5">
                  <label className="block"><span className="field-label">Größe</span><input type="range" min="160" max="520" value={selectedItem.width ?? 260} onChange={(event) => patchLocal(selectedItem.id, { width: Number(event.target.value) })} onPointerUp={() => void patchItem(selectedItem.id, { width: boardRef.current?.items.find((item) => item.id === selectedItem.id)?.width ?? 260 })} className="w-full accent-primary" /></label>
                  <label className="block"><span className="field-label">Drehung</span><input type="range" min="-12" max="12" value={selectedItem.rotation} onChange={(event) => patchLocal(selectedItem.id, { rotation: Number(event.target.value) })} onPointerUp={() => void patchItem(selectedItem.id, { rotation: boardRef.current?.items.find((item) => item.id === selectedItem.id)?.rotation ?? 0 })} className="w-full accent-primary" /></label>
                  <div><span className="field-label">Bewertung</span><RatingButtons item={selectedItem} onChange={(rating) => void patchItem(selectedItem.id, { rating })} /></div>
                  <label className="block"><span className="field-label">Notiz / Detailwunsch</span><textarea value={selectedItem.note || ''} onChange={(event) => patchLocal(selectedItem.id, { note: event.target.value })} onBlur={() => void patchItem(selectedItem.id, { note: boardRef.current?.items.find((item) => item.id === selectedItem.id)?.note || null })} className="field min-h-28 resize-none" placeholder="z. B. Kantenprofil übernehmen …" /></label>
                </div>
                <div className="mt-6 grid gap-2 border-t border-border pt-5">
                  <Button variant="outline" onClick={() => { const nextZ = Math.max(...board.items.map((item) => item.zIndex)) + 1; void patchItem(selectedItem.id, { zIndex: nextZ }) }}><BringToFront className="size-4" />Nach vorne</Button>
                  <Button variant="ghost" className="text-red-700" onClick={() => void removeItem(selectedItem.id)}><Trash2 className="size-4" />Von Pinnwand entfernen</Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center text-center"><Presentation className="size-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">Bild auswählen</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Klicke auf ein Bild, um Größe, Bewertung und Notiz zu bearbeiten.</p></div>
            )}
          </aside>
        </div>
      ) : (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
          {board.items.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-[1.25rem] border border-border bg-card p-3 print:break-inside-avoid">
              <img src={item.image.url} alt={item.image.title || item.image.filename} className="aspect-[4/3] w-full rounded-xl object-cover" />
              <div className="p-2 pt-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">{item.image.title || item.image.filename}</h3><p className="mt-1 text-xs text-muted-foreground">{item.image.tags.slice(0, 3).map((tag) => tag.name).join(' · ')}</p></div><div className="print:hidden"><RatingButtons item={item} compact onChange={(rating) => void patchItem(item.id, { rating })} /></div></div>
                <textarea value={item.note || ''} onChange={(event) => patchLocal(item.id, { note: event.target.value })} onBlur={() => void patchItem(item.id, { note: boardRef.current?.items.find((entry) => entry.id === item.id)?.note || null })} className="field mt-4 min-h-20 resize-none print:border-0 print:p-0" placeholder="Notiz oder Gestaltungswunsch …" />
                <button onClick={() => void removeItem(item.id)} className="mt-3 inline-flex items-center gap-2 text-xs text-red-700 hover:underline print:hidden"><Trash2 className="size-3.5" />Entfernen</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AddImagesDialog boardId={id} existingImageIds={existingImageIds} open={addOpen} onOpenChange={setAddOpen} onAdded={load} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[1.4rem] p-7 sm:p-8">
          <DialogTitle className="font-display text-3xl font-normal">Moodboard bearbeiten</DialogTitle>
          <DialogDescription className="mt-2">Name und Ziel des Gestaltungskonzepts.</DialogDescription>
          <form onSubmit={saveBoard} className="mt-6 space-y-5">
            <label><span className="field-label">Name</span><input className="field" value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
            <label><span className="field-label">Projektbeschreibung</span><textarea className="field min-h-28 resize-none" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label>
            <div className="flex flex-wrap justify-between gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => void removeBoard()} className={deleteConfirm ? 'text-red-700' : ''}><Trash2 className="size-4" />{deleteConfirm ? 'Wirklich löschen?' : 'Moodboard löschen'}</Button>
              <Button type="submit" disabled={saving || !editName.trim()}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Speichern</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RatingButtons({ item, onChange, compact = false }: { item: MoodboardItem; onChange: (rating: 'LIKE' | 'DISLIKE' | null) => void; compact?: boolean }) {
  return (
    <div className={cn('flex gap-2', !compact && 'mt-2')}>
      <button type="button" onClick={() => onChange(item.rating === 'LIKE' ? null : 'LIKE')} className={cn('inline-flex items-center justify-center gap-2 rounded-lg border border-border transition hover:bg-muted', compact ? 'size-8' : 'h-9 flex-1 px-3 text-xs font-semibold', item.rating === 'LIKE' && 'border-primary bg-primary text-white hover:bg-primary')}><ThumbsUp className="size-3.5" />{!compact && 'Gefällt'}</button>
      <button type="button" onClick={() => onChange(item.rating === 'DISLIKE' ? null : 'DISLIKE')} className={cn('inline-flex items-center justify-center gap-2 rounded-lg border border-border transition hover:bg-muted', compact ? 'size-8' : 'h-9 flex-1 px-3 text-xs font-semibold', item.rating === 'DISLIKE' && 'border-[#9e4e3e] bg-[#9e4e3e] text-white hover:bg-[#9e4e3e]')}><ThumbsDown className="size-3.5" />{!compact && 'Nicht passend'}</button>
    </div>
  )
}

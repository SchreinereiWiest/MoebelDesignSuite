import { useEffect, useState } from 'react'
import { Check, LayoutGrid, LoaderCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { addCollectionItem, createCollection, listCollections } from '@/lib/api'
import type { CollectionSummary, ImageSummary } from '@/types'

export function AddToMoodboardDialog({
  image,
  open,
  onOpenChange,
}: {
  image: ImageSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [boards, setBoards] = useState<CollectionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState('')
  const [doneId, setDoneId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setDoneId(null)
    setError(null)
    void listCollections({ limit: 100 })
      .then((response) => setBoards(response.data))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'Moodboards konnten nicht geladen werden.'),
      )
      .finally(() => setLoading(false))
  }, [open])

  async function add(boardId: string) {
    if (!image) return
    setSavingId(boardId)
    setError(null)
    try {
      await addCollectionItem(boardId, image.id)
      setDoneId(boardId)
      window.dispatchEvent(new CustomEvent('collections-changed'))
      window.setTimeout(() => onOpenChange(false), 650)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bild konnte nicht hinzugefügt werden.')
    } finally {
      setSavingId(null)
    }
  }

  async function createAndAdd(event: React.FormEvent) {
    event.preventDefault()
    if (!createdName.trim() || !image) return
    setSavingId('new')
    setError(null)
    try {
      const board = await createCollection({ name: createdName.trim() })
      await addCollectionItem(board.id, image.id)
      setDoneId(board.id)
      window.dispatchEvent(new CustomEvent('collections-changed'))
      window.setTimeout(() => onOpenChange(false), 650)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboard konnte nicht erstellt werden.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-[1.4rem] p-7 sm:p-8">
        <DialogTitle className="font-display text-3xl font-normal">Inspiration vormerken</DialogTitle>
        <DialogDescription className="mt-2">
          Wähle das Moodboard, auf dem du das Bild weiterentwickeln möchtest.
        </DialogDescription>

        {loading ? (
          <div className="grid min-h-40 place-items-center">
            <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            {boards.map((board) => (
              <button
                type="button"
                key={board.id}
                onClick={() => void add(board.id)}
                disabled={savingId !== null}
                className="flex w-full items-center gap-4 rounded-xl border border-border p-3 text-left transition hover:border-foreground/40 hover:bg-muted"
              >
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary">
                  {board.covers[0]?.url ? (
                    <img src={board.covers[0].url} alt="" className="size-full object-cover" />
                  ) : (
                    <LayoutGrid className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{board.name}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {board.itemCount} Inspirationen
                  </span>
                </span>
                {savingId === board.id ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : doneId === board.id ? (
                  <Check className="size-5 text-primary" />
                ) : (
                  <Plus className="size-4" />
                )}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={createAndAdd} className="mt-6 border-t border-border pt-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Oder neues Moodboard
          </label>
          <div className="flex gap-2">
            <input
              value={createdName}
              onChange={(event) => setCreatedName(event.target.value)}
              placeholder="Name des Moodboards"
              className="field"
            />
            <Button type="submit" disabled={!createdName.trim() || savingId !== null}>
              {savingId === 'new' ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Anlegen
            </Button>
          </div>
        </form>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

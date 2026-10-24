import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { createCollection } from '@/lib/api'

export function CreateMoodboardDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const board = await createCollection({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
      onOpenChange(false)
      onCreated(board.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboard konnte nicht erstellt werden.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[1.4rem] p-7 sm:p-8">
        <DialogTitle className="font-display text-3xl font-normal">Neues Moodboard</DialogTitle>
        <DialogDescription className="mt-2 leading-6">
          Gib dem Konzept einen klaren Namen. Inspirationen kannst du anschließend direkt hinzufügen.
        </DialogDescription>
        <form onSubmit={submit} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="z. B. Wohnbereich Familie Müller"
              className="field"
              maxLength={160}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Kurzbeschreibung
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Raum, Ziel und erste Gedanken …"
              className="field min-h-28 resize-none"
              maxLength={2000}
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!name.trim() || loading}>
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              Moodboard anlegen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { Check, ImagePlus, LoaderCircle, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { addCollectionItem, listImages } from '@/lib/api'
import type { ImageSummary } from '@/types'

export function AddImagesDialog({
  boardId,
  existingImageIds,
  open,
  onOpenChange,
  onAdded,
}: {
  boardId: string
  existingImageIds: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}) {
  const [images, setImages] = useState<ImageSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    void listImages({ limit: 100, search })
      .then((response) => setImages(response.data))
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Bilder konnten nicht geladen werden.'))
      .finally(() => setLoading(false))
  }, [open, search])

  async function add(imageId: string) {
    setAddingId(imageId)
    setError(null)
    try {
      await addCollectionItem(boardId, imageId)
      setAddedIds((current) => new Set(current).add(imageId))
      onAdded()
      window.dispatchEvent(new CustomEvent('collections-changed'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bild konnte nicht hinzugefügt werden.')
    } finally {
      setAddingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[min(58rem,calc(100%-2rem))] overflow-y-auto rounded-[1.5rem] p-6 sm:p-8">
        <DialogTitle className="font-display text-3xl font-normal">Inspirationen hinzufügen</DialogTitle>
        <DialogDescription className="mt-2">Wähle Bilder aus deiner Bibliothek für dieses Moodboard.</DialogDescription>
        <div className="relative mt-6">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input className="field pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Bibliothek durchsuchen …" />
        </div>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {loading ? (
          <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-5 animate-spin" /></div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image) => {
              const added = existingImageIds.has(image.id) || addedIds.has(image.id)
              return (
                <button
                  type="button"
                  key={image.id}
                  onClick={() => !added && void add(image.id)}
                  disabled={added || addingId !== null}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary text-left disabled:opacity-70"
                >
                  {image.thumbnailUrl ? <img src={image.thumbnailUrl} alt={image.title || image.filename} className="size-full object-cover transition group-hover:scale-105" /> : <span className="grid size-full place-items-center"><ImagePlus className="size-5 text-muted-foreground" /></span>}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2.5 pt-8 text-xs font-semibold text-white">{image.title || image.filename}</span>
                  {addingId === image.id && <span className="absolute inset-0 grid place-items-center bg-black/35"><LoaderCircle className="size-5 animate-spin text-white" /></span>}
                  {added && <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-primary text-white"><Check className="size-4" /></span>}
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

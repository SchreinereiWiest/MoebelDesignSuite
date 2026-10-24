import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileImage, LoaderCircle, UploadCloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { DESIGN_GROUPS } from '@/lib/design-options'
import { uploadImage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ImageVisibility } from '@/types'

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function UploadDialog({
  open,
  onOpenChange,
  onUploaded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ImageVisibility>('PRIVATE')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function chooseFile(nextFile?: File) {
    if (!nextFile) return
    if (!acceptedTypes.includes(nextFile.type)) {
      setError('Bitte verwende JPG, PNG, WebP oder AVIF.')
      return
    }
    if (nextFile.size > 50 * 1024 * 1024) {
      setError('Das Bild darf maximal 50 MB groß sein.')
      return
    }
    setFile(nextFile)
    setTitle(nextFile.name.replace(/\.[^.]+$/, ''))
    setError(null)
  }

  function toggleTag(slug: string) {
    setSelectedTags((current) => {
      const next = new Set(current)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setPhase('uploading')
    setProgress(0)
    setError(null)
    try {
      const allOptions = DESIGN_GROUPS.flatMap((group) => group.options)
      await uploadImage(
        file,
        {
          title: title.trim(),
          description: description.trim(),
          visibility,
          rightsConfirmed,
          tags: allOptions
            .filter((option) => selectedTags.has(option.slug))
            .map(({ name, category }) => ({ name, category })),
        },
        setProgress,
      )
      setPhase('done')
      onUploaded?.()
      window.dispatchEvent(new CustomEvent('images-changed'))
    } catch (caught) {
      setPhase('idle')
      setError(caught instanceof Error ? caught.message : 'Upload fehlgeschlagen.')
    }
  }

  function resetAndClose() {
    setFile(null)
    setTitle('')
    setDescription('')
    setVisibility('PRIVATE')
    setRightsConfirmed(false)
    setSelectedTags(new Set())
    setProgress(0)
    setPhase('idle')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="max-h-[90vh] w-[min(48rem,calc(100%-2rem))] overflow-y-auto rounded-[1.4rem] p-6 sm:p-8">
        {phase === 'done' ? (
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="grid size-16 place-items-center rounded-full bg-primary text-white">
              <Check className="size-7" />
            </div>
            <DialogTitle className="mt-6 font-display text-3xl font-normal">Bild ist unterwegs</DialogTitle>
            <DialogDescription className="mt-3 max-w-sm leading-6">
              Der Upload ist abgeschlossen. Vorschauen und technische Merkmale werden jetzt automatisch erzeugt.
            </DialogDescription>
            <Button className="mt-7" onClick={resetAndClose}>
              Zur Bibliothek
            </Button>
          </div>
        ) : (
          <>
            <DialogTitle className="font-display text-3xl font-normal">Inspiration hinzufügen</DialogTitle>
            <DialogDescription className="mt-2 leading-6">
              Lade ein eigenes Bild hoch und ordne es direkt den wichtigsten Gestaltungsmerkmalen zu.
            </DialogDescription>
            <form onSubmit={submit} className="mt-6">
              {!file ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragEnter={() => setDragging(true)}
                  onDragLeave={() => setDragging(false)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    chooseFile(event.dataTransfer.files[0])
                  }}
                  className={cn(
                    'flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition',
                    dragging ? 'border-accent bg-accent/5' : 'border-border bg-muted/50 hover:bg-muted',
                  )}
                >
                  <span className="grid size-12 place-items-center rounded-full bg-card shadow-sm">
                    <UploadCloud className="size-5" />
                  </span>
                  <span className="mt-4 text-sm font-semibold">Bild hier ablegen oder auswählen</span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP oder AVIF · max. 50 MB</span>
                </button>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/45 p-3">
                  <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                    {previewUrl && <img src={previewUrl} alt="Vorschau" className="size-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full hover:bg-card"
                    onClick={() => setFile(null)}
                    aria-label="Datei entfernen"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                className="sr-only"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label>
                  <span className="field-label">Titel</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} className="field" placeholder="Kurzer, beschreibender Titel" />
                </label>
                <label>
                  <span className="field-label">Freigabe</span>
                  <select value={visibility} onChange={(event) => setVisibility(event.target.value as ImageVisibility)} className="field">
                    <option value="PRIVATE">Nur für die eigene Firma</option>
                    <option value="RESTRICTED">Für andere Firmen freigeben</option>
                    <option value="PUBLIC">Auch öffentlich freigeben</option>
                  </select>
                </label>
              </div>
              {visibility !== 'PRIVATE' && (
                <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <input type="checkbox" className="mt-0.5" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
                  <span>Ich bestätige, dass meine Firma die erforderlichen Rechte besitzt und dieses Bild in der gewählten Stufe weitergeben darf.</span>
                </label>
              )}
              <label className="mt-5 block">
                <span className="field-label">Notiz</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="field min-h-20 resize-none" placeholder="Was gefällt dir an diesem Bild?" />
              </label>

              <div className="mt-6 border-t border-border pt-6">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <span className="field-label">Kategorisierung</span>
                    <p className="text-xs text-muted-foreground">Mehrere Merkmale sind möglich.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{selectedTags.size} gewählt</span>
                </div>
                <div className="space-y-4">
                  {DESIGN_GROUPS.map((group) => (
                    <div key={group.key} className="grid gap-2 sm:grid-cols-[6rem_1fr] sm:items-start">
                      <span className="pt-1.5 text-xs font-semibold text-muted-foreground">{group.shortLabel}</span>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => (
                          <button
                            type="button"
                            key={option.slug}
                            onClick={() => toggleTag(option.slug)}
                            className={cn('filter-chip', selectedTags.has(option.slug) && 'filter-chip-active')}
                          >
                            {option.swatch && <span className="size-3 rounded-full border border-black/10" style={{ background: option.swatch }} />}
                            {option.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {phase === 'uploading' && (
                <div className="mt-6">
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                    <span>Bild wird übertragen …</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
              <div className="mt-7 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={resetAndClose} disabled={phase === 'uploading'}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={!file || phase === 'uploading' || (visibility !== 'PRIVATE' && !rightsConfirmed)}>
                  {phase === 'uploading' ? <LoaderCircle className="size-4 animate-spin" /> : <FileImage className="size-4" />}
                  {phase === 'uploading' ? 'Wird hochgeladen' : 'Bild hinzufügen'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

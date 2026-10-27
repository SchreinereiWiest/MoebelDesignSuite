import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileImage, ImagePlus, LoaderCircle, Trash2, UploadCloud } from 'lucide-react'
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
const maxFileSize = 50 * 1024 * 1024

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function titleFromFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, '')
}

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
  const [queue, setQueue] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ImageVisibility>('PRIVATE')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const file = queue[0] ?? null
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function prepareEditor(nextFile: File | null) {
    setTitle(nextFile ? titleFromFilename(nextFile.name) : '')
    setDescription('')
    setVisibility('PRIVATE')
    setRightsConfirmed(false)
    setSelectedTags(new Set())
    setProgress(0)
    setError(null)
  }

  function addFiles(files: FileList | File[]) {
    if (phase !== 'idle') return

    const incoming = Array.from(files)
    const accepted: File[] = []
    let unsupportedCount = 0
    let oversizedCount = 0
    const knownFiles = new Set(queue.map(fileKey))

    for (const nextFile of incoming) {
      if (!acceptedTypes.includes(nextFile.type)) {
        unsupportedCount += 1
        continue
      }
      if (nextFile.size > maxFileSize) {
        oversizedCount += 1
        continue
      }
      const key = fileKey(nextFile)
      if (!knownFiles.has(key)) {
        accepted.push(nextFile)
        knownFiles.add(key)
      }
    }

    if (!file && accepted[0]) prepareEditor(accepted[0])
    if (accepted.length) setQueue((current) => [...current, ...accepted])

    const messages = []
    if (unsupportedCount) messages.push(`${unsupportedCount} Datei(en) mit nicht unterstütztem Format`)
    if (oversizedCount) messages.push(`${oversizedCount} Datei(en) über 50 MB`)
    setError(messages.length ? `${messages.join(' und ')} wurden übersprungen.` : null)

    if (inputRef.current) inputRef.current.value = ''
  }

  function advanceQueue() {
    const remaining = queue.slice(1)
    setQueue(remaining)
    prepareEditor(remaining[0] ?? null)
    return remaining
  }

  function discardCurrent() {
    if (!file || phase !== 'idle') return
    const remaining = advanceQueue()
    if (!remaining.length && uploadedCount > 0) setPhase('done')
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

      const remaining = advanceQueue()
      setUploadedCount((current) => current + 1)
      onUploaded?.()
      window.dispatchEvent(new CustomEvent('images-changed'))
      setPhase(remaining.length ? 'idle' : 'done')
    } catch (caught) {
      setPhase('idle')
      setError(caught instanceof Error ? caught.message : 'Upload fehlgeschlagen.')
    }
  }

  function resetAndClose() {
    if (phase === 'uploading') return
    setQueue([])
    setUploadedCount(0)
    setDragging(false)
    prepareEditor(null)
    setPhase('idle')
    onOpenChange(false)
  }

  const totalCount = uploadedCount + queue.length
  const currentPosition = uploadedCount + 1

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true)
        else resetAndClose()
      }}
    >
      <DialogContent className="max-h-[90vh] w-[min(52rem,calc(100%-2rem))] overflow-y-auto rounded-[1.4rem] p-6 sm:p-8">
        {phase === 'done' ? (
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="grid size-16 place-items-center rounded-full bg-primary text-white">
              <Check className="size-7" />
            </div>
            <DialogTitle className="mt-6 font-display text-3xl font-normal">
              {uploadedCount === 1 ? 'Bild ist unterwegs' : `${uploadedCount} Bilder sind unterwegs`}
            </DialogTitle>
            <DialogDescription className="mt-3 max-w-sm leading-6">
              {uploadedCount === 1 ? 'Der Upload ist' : 'Die Uploads sind'} abgeschlossen. Vorschauen und technische Merkmale werden jetzt automatisch erzeugt.
            </DialogDescription>
            <Button className="mt-7" onClick={resetAndClose}>
              Zur Bibliothek
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
              <div>
                <DialogTitle className="font-display text-3xl font-normal">Inspirationen hinzufügen</DialogTitle>
                <DialogDescription className="mt-2 leading-6">
                  Lege mehrere Bilder ab und bearbeite sie anschließend nacheinander.
                </DialogDescription>
              </div>
              {file && (
                <div className="rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  Bild {currentPosition} von {totalCount}
                </div>
              )}
            </div>

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
                    addFiles(event.dataTransfer.files)
                  }}
                  className={cn(
                    'flex min-h-52 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition',
                    dragging ? 'border-accent bg-accent/5' : 'border-border bg-muted/50 hover:bg-muted',
                  )}
                >
                  <span className="grid size-12 place-items-center rounded-full bg-card shadow-sm">
                    <UploadCloud className="size-5" />
                  </span>
                  <span className="mt-4 text-sm font-semibold">Bilder hier ablegen oder auswählen</span>
                  <span className="mt-1 text-xs text-muted-foreground">Mehrfachauswahl · JPG, PNG, WebP oder AVIF · je max. 50 MB</span>
                </button>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/45 p-3">
                  <div className="flex items-center gap-4">
                    <div
                      className="relative shrink-0 overflow-hidden rounded-xl bg-secondary"
                      style={{ width: 480, height: 480, minWidth: 96, minHeight: 96, flexBasis: 480 }}
                    >
                      {previewUrl && (
                        <img
                          src={previewUrl}
                          alt="Vorschau des aktuellen Bildes"
                          width={96}
                          height={96}
                          className="absolute inset-0 block h-full w-full object-contain"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Aktuelles Bild</p>
                      <p className="mt-1 truncate text-sm font-semibold">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                      {queue[1] && (
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                          Danach: {queue[1].name}{queue.length > 2 ? ` · ${queue.length - 2} weitere` : ''}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="hidden shrink-0 sm:inline-flex"
                      onClick={() => inputRef.current?.click()}
                      disabled={phase === 'uploading'}
                    >
                      <ImagePlus className="size-4" />
                      Weitere
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-card sm:hidden"
                    onClick={() => inputRef.current?.click()}
                    disabled={phase === 'uploading'}
                  >
                    <ImagePlus className="size-4" />
                    Weitere Bilder hinzufügen
                  </button>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={acceptedTypes.join(',')}
                className="sr-only"
                onChange={(event) => event.target.files && addFiles(event.target.files)}
              />

              <fieldset disabled={!file || phase === 'uploading'} className="disabled:opacity-60">
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
              </fieldset>

              {phase === 'uploading' && (
                <div className="mt-6" aria-live="polite">
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                    <span>{file?.name} wird übertragen …</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
              {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-7 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
                <Button type="button" variant="ghost" onClick={resetAndClose} disabled={phase === 'uploading'}>
                  Abbrechen
                </Button>
                {file && (
                  <Button type="button" variant="outline" onClick={discardCurrent} disabled={phase === 'uploading'}>
                    <Trash2 className="size-4" />
                    Aktuelles verwerfen
                  </Button>
                )}
                <Button type="submit" disabled={!file || phase === 'uploading' || (visibility !== 'PRIVATE' && !rightsConfirmed)}>
                  {phase === 'uploading' ? <LoaderCircle className="size-4 animate-spin" /> : <FileImage className="size-4" />}
                  {phase === 'uploading' ? 'Wird hochgeladen' : queue.length > 1 ? 'Hochladen & nächstes' : 'Bild hochladen'}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

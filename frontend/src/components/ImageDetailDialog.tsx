import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  ImageIcon,
  LoaderCircle,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { deleteImage, getImage, updateImage } from '@/lib/api'
import { CATEGORY_LABELS } from '@/lib/design-options'
import { useAuth } from '@/features/auth/auth-context'
import type { ImageDetail, ImageSummary, ImageVisibility } from '@/types'

export function ImageDetailDialog({
  image,
  open,
  onOpenChange,
  onChanged,
}: {
  image: ImageSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged?: () => void
}) {
  const { session } = useAuth()
  const canUsePublicContent = session!.permissions.usePublicContent
  const [detail, setDetail] = useState<ImageDetail | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<ImageVisibility>('PRIVATE')
  const [rightsConfirmed, setRightsConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !image) return
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setDetail(null)
      setError(null)
      setConfirmDelete(false)
      void getImage(image.id)
        .then((data) => {
          if (!active) return
          setDetail(data)
          setTitle(data.title || data.filename.replace(/\.[^.]+$/, ''))
          setDescription(data.description || '')
          setVisibility(data.visibility)
          setRightsConfirmed(Boolean(data.rightsConfirmedAt))
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : 'Bilddetails konnten nicht geladen werden.')
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })
    return () => {
      active = false
    }
  }, [image, open])

  async function save() {
    if (!detail) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await updateImage(detail.id, { title, description, visibility, rightsConfirmed })
      setDetail({ ...detail, title, description, visibility })
      setSaved(true)
      onChanged?.()
      window.dispatchEvent(new CustomEvent('images-changed'))
      window.setTimeout(() => setSaved(false), 1500)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Änderungen konnten nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!detail) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await deleteImage(detail.id)
      onChanged?.()
      window.dispatchEvent(new CustomEvent('images-changed'))
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bild konnte nicht gelöscht werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(64rem,calc(100%-2rem))] overflow-y-auto rounded-[1.5rem] p-0">
        {loading ? (
          <div className="grid min-h-[34rem] place-items-center">
            <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="grid min-h-[34rem] lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative min-h-80 overflow-hidden bg-[#d8d1c4] lg:min-h-[42rem]">
              <img
                src={detail.imageUrl}
                alt={detail.title || detail.filename}
                className="absolute inset-0 size-full object-contain"
              />
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <div>
                <p className="eyebrow">Bilddetails</p>
                <DialogTitle className="mt-2 font-display text-3xl font-normal">
                  {detail.title || detail.filename}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Metadaten und Freigabe des ausgewählten Inspirationsbilds bearbeiten.
                </DialogDescription>
              </div>

              <div className="mt-7 space-y-5">
                <label>
                  <span className="field-label">Titel</span>
                  <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!detail.canManage} />
                </label>
                <label>
                  <span className="field-label">Persönliche Notiz</span>
                  <textarea
                    className="field min-h-24 resize-none"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Was ist an dieser Inspiration wichtig?"
                    disabled={!detail.canManage}
                  />
                </label>
                <label>
                  <span className="field-label">Nutzungsfreigabe</span>
                  <select className="field" value={visibility} onChange={(event) => setVisibility(event.target.value as ImageVisibility)} disabled={!detail.canManage}>
                    <option value="PRIVATE">Nur für die eigene Firma</option>
                    <option value="RESTRICTED" disabled={!canUsePublicContent}>Für andere Firmen freigeben</option>
                    <option value="PUBLIC" disabled={!canUsePublicContent}>Auch öffentlich freigeben</option>
                  </select>
                </label>
                {detail.canManage && visibility !== 'PRIVATE' && !detail.rightsConfirmedAt && (
                  <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <input type="checkbox" className="mt-0.5" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
                    <span>Meine Firma besitzt die erforderlichen Rechte für diese externe Freigabe.</span>
                  </label>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {detail.tags.map((tag) => (
                  <span key={tag.slug} className="rounded-full bg-muted px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">{CATEGORY_LABELS[tag.category]} · </span>
                    {tag.name}
                  </span>
                ))}
              </div>

              <dl className="mt-7 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <ImageIcon className="size-4" />
                  <span>{detail.width && detail.height ? `${detail.width} × ${detail.height} px` : 'In Verarbeitung'}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <CalendarDays className="size-4" />
                  <span>{new Intl.DateTimeFormat('de-DE').format(new Date(detail.createdAt))}</span>
                </div>
                <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border p-3">
                  <ShieldCheck className="size-4" />
                  <span>{detail.filename}</span>
                </div>
              </dl>

              {error && <p className="mt-5 text-sm text-red-700">{error}</p>}
              {detail.canManage ? <div className="mt-auto flex flex-wrap justify-between gap-3 pt-8">
                <Button type="button" variant="ghost" onClick={() => void remove()} disabled={saving} className={confirmDelete ? 'text-red-700' : ''}>
                  <Trash2 className="size-4" />
                  {confirmDelete ? 'Wirklich löschen?' : 'Bild löschen'}
                </Button>
                <Button type="button" onClick={() => void save()} disabled={saving || (visibility !== 'PRIVATE' && (!canUsePublicContent || !rightsConfirmed))}>
                  {saving ? <LoaderCircle className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : <Save className="size-4" />}
                  {saved ? 'Gespeichert' : 'Änderungen speichern'}
                </Button>
              </div> : <p className="mt-auto pt-8 text-xs text-muted-foreground">Dieses Bild wurde von einer anderen Firma freigegeben und ist daher schreibgeschützt.</p>}
            </div>
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center px-8 text-center text-sm text-red-700">
            {error || 'Bild nicht gefunden.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

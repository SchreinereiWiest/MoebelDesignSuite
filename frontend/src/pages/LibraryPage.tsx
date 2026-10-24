import { useCallback, useEffect, useMemo, useState } from 'react'
import { Filter, Grid2X2, Images, LayoutGrid, ListFilter, Plus, Search, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { AddToMoodboardDialog } from '@/components/AddToMoodboardDialog'
import { EmptyState } from '@/components/EmptyState'
import { ImageCard } from '@/components/ImageCard'
import { ImageDetailDialog } from '@/components/ImageDetailDialog'
import { LoadingState } from '@/components/LoadingState'
import { UploadDialog } from '@/components/UploadDialog'
import { Button } from '@/components/ui/button'
import { listImages, listTags } from '@/lib/api'
import { DESIGN_GROUPS } from '@/lib/design-options'
import { cn } from '@/lib/utils'
import type { DesignTag, ImageSummary, ImageVisibility } from '@/types'

export function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [visibility, setVisibility] = useState<ImageVisibility | ''>('')
  const [match, setMatch] = useState<'all' | 'any'>('all')
  const [page, setPage] = useState(1)
  const [images, setImages] = useState<ImageSummary[]>([])
  const [total, setTotal] = useState(0)
  const [knownTags, setKnownTags] = useState<DesignTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [compact, setCompact] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ImageSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const currentSearch = searchParams.get('search') || ''
  const selectedTagList = useMemo(() => [...selectedTags], [selectedTags])
  const counts = useMemo(() => new Map(knownTags.map((tag) => [tag.slug, tag.imageCount ?? 0])), [knownTags])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listImages({
        page,
        limit: 24,
        search: currentSearch,
        tags: selectedTagList,
        match,
        visibility: visibility || undefined,
      })
      setImages(response.data)
      setTotal(response.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Bibliothek konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [currentSearch, match, page, selectedTagList, visibility])

  useEffect(() => {
    void listTags().then(setKnownTags).catch(() => undefined)
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener('images-changed', load)
    return () => window.removeEventListener('images-changed', load)
  }, [load])

  useEffect(() => {
    if (!images.some((image) => image.status === 'QUEUED' || image.status === 'PROCESSING')) return
    const timer = window.setTimeout(() => void load(), 4500)
    return () => window.clearTimeout(timer)
  }, [images, load])

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (search.trim()) next.set('search', search.trim())
    else next.delete('search')
    setPage(1)
    setSearchParams(next)
  }

  function toggleTag(slug: string) {
    setPage(1)
    setSelectedTags((current) => {
      const next = new Set(current)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  function clearFilters() {
    setSelectedTags(new Set())
    setVisibility('')
    setSearch('')
    setSearchParams({})
    setPage(1)
  }

  const filterCount = selectedTags.size + (visibility ? 1 : 0)
  const pages = Math.max(1, Math.ceil(total / 24))

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Inspiration Library</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Ideen, die etwas auslösen.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Durchsuche deine Sammlung, kombiniere Merkmale und merke Bilder für konkrete Konzepte vor.</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}><Plus className="size-4" />Inspiration hinzufügen</Button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-border py-4">
        <form onSubmit={submitSearch} className="relative min-w-56 flex-1 sm:max-w-lg">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="field pl-10" placeholder="Titel, Dateiname oder Notiz suchen …" />
        </form>
        <Button variant="outline" onClick={() => setFiltersOpen((value) => !value)} className="lg:hidden">
          <Filter className="size-4" />Filter{filterCount ? ` (${filterCount})` : ''}
        </Button>
        <div className="ml-auto flex rounded-lg border border-border bg-card p-1">
          <button type="button" onClick={() => setCompact(false)} className={cn('grid size-8 place-items-center rounded-md', !compact && 'bg-secondary')} aria-label="Große Galerie"><Grid2X2 className="size-4" /></button>
          <button type="button" onClick={() => setCompact(true)} className={cn('grid size-8 place-items-center rounded-md', compact && 'bg-secondary')} aria-label="Kompakte Galerie"><LayoutGrid className="size-4" /></button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside className={cn('space-y-6', filtersOpen ? 'block' : 'hidden lg:block')}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold"><ListFilter className="size-4" />Filter</span>
            {filterCount > 0 && <button onClick={clearFilters} className="text-xs text-muted-foreground underline">Zurücksetzen</button>}
          </div>
          <div>
            <label className="field-label">Freigabe</label>
            <select className="field" value={visibility} onChange={(event) => { setVisibility(event.target.value as ImageVisibility | ''); setPage(1) }}>
              <option value="">Alle Freigaben</option>
              <option value="PRIVATE">Privat</option>
              <option value="RESTRICTED">Beratung</option>
              <option value="PUBLIC">Freigegeben</option>
            </select>
          </div>
          {DESIGN_GROUPS.map((group, index) => (
            <details key={group.key} open={index < 3} className="group border-b border-border pb-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.12em]">
                {group.shortLabel}<Plus className="size-3.5 transition group-open:rotate-45" />
              </summary>
              <div className="mt-3 space-y-1">
                {group.options.map((option) => (
                  <label key={option.slug} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-card">
                    <input type="checkbox" checked={selectedTags.has(option.slug)} onChange={() => toggleTag(option.slug)} className="size-4 rounded border-border accent-primary" />
                    <span className="flex-1">{option.name}</span>
                    {!!counts.get(option.slug) && <span className="text-xs text-muted-foreground">{counts.get(option.slug)}</span>}
                  </label>
                ))}
              </div>
            </details>
          ))}
          {selectedTags.size > 1 && (
            <div className="rounded-xl bg-card p-3">
              <p className="text-xs font-semibold">Trefferlogik</p>
              <div className="mt-2 grid grid-cols-2 rounded-lg bg-muted p-1 text-xs">
                <button onClick={() => setMatch('all')} className={cn('rounded-md px-2 py-1.5', match === 'all' && 'bg-white shadow-sm')}>Exakt</button>
                <button onClick={() => setMatch('any')} className={cn('rounded-md px-2 py-1.5', match === 'any' && 'bg-white shadow-sm')}>Ähnlich</button>
              </div>
            </div>
          )}
        </aside>

        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">{total}</span> Inspirationen</p>
            {filterCount > 0 && (
              <div className="flex flex-wrap gap-2">
                {[...selectedTags].map((slug) => (
                  <button key={slug} onClick={() => toggleTag(slug)} className="filter-chip filter-chip-active">{knownTags.find((tag) => tag.slug === slug)?.name || slug}<X className="size-3" /></button>
                ))}
              </div>
            )}
          </div>

          {loading ? <LoadingState label="Inspirationen werden kuratiert …" /> : error ? (
            <EmptyState icon={Images} title="Bibliothek nicht erreichbar" description={error} action={<Button onClick={() => void load()}>Erneut laden</Button>} />
          ) : images.length ? (
            <div className={cn('grid gap-x-3 gap-y-8 sm:grid-cols-2 md:grid-cols-3', compact ? 'xl:grid-cols-5 2xl:grid-cols-6' : 'xl:grid-cols-4 2xl:grid-cols-5')}>
              {images.map((image) => (
                <ImageCard key={image.id} image={image} compact={compact} onOpen={() => { setSelectedImage(image); setDetailOpen(true) }} onSave={() => { setSelectedImage(image); setSaveOpen(true) }} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Images} title="Keine passenden Bilder" description="Passe die Filter an oder ergänze ein neues Inspirationsbild mit den gesuchten Merkmalen." action={<Button onClick={filterCount || currentSearch ? clearFilters : () => setUploadOpen(true)}>{filterCount || currentSearch ? 'Filter zurücksetzen' : 'Bild hochladen'}</Button>} />
          )}

          {pages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Zurück</Button>
              <span className="text-xs text-muted-foreground">Seite {page} von {pages}</span>
              <Button variant="outline" disabled={page === pages} onClick={() => setPage((value) => value + 1)}>Weiter</Button>
            </div>
          )}
        </section>
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} />
      <ImageDetailDialog image={selectedImage} open={detailOpen} onOpenChange={setDetailOpen} onChanged={load} />
      <AddToMoodboardDialog image={selectedImage} open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}

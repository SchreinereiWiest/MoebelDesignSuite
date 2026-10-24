import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Compass, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react'
import { AddToMoodboardDialog } from '@/components/AddToMoodboardDialog'
import { EmptyState } from '@/components/EmptyState'
import { ImageCard } from '@/components/ImageCard'
import { ImageDetailDialog } from '@/components/ImageDetailDialog'
import { LoadingState } from '@/components/LoadingState'
import { Button } from '@/components/ui/button'
import { listImages } from '@/lib/api'
import { DESIGN_GROUPS } from '@/lib/design-options'
import { cn } from '@/lib/utils'
import type { ImageSummary } from '@/types'

export function ExplorerPage() {
  const [step, setStep] = useState(0)
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(DESIGN_GROUPS.map((group) => [group.key, new Set<string>()])),
  )
  const [match, setMatch] = useState<'all' | 'any'>('any')
  const [images, setImages] = useState<ImageSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const group = DESIGN_GROUPS[step]
  const selectedSlugs = useMemo(() => Object.values(selections).flatMap((values) => [...values]), [selections])
  const selectedOptions = useMemo(
    () => DESIGN_GROUPS.flatMap((item) => item.options).filter((option) => selectedSlugs.includes(option.slug)),
    [selectedSlugs],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void listImages({ limit: 18, tags: selectedSlugs, match })
      .then((response) => {
        if (controller.signal.aborted) return
        setImages(response.data)
        setTotal(response.total)
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Ergebnisse konnten nicht geladen werden.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [match, selectedSlugs])

  function toggle(slug: string) {
    setSelections((current) => {
      const next = { ...current, [group.key]: new Set(current[group.key]) }
      if (next[group.key].has(slug)) next[group.key].delete(slug)
      else next[group.key].add(slug)
      return next
    })
  }

  function reset() {
    setSelections(Object.fromEntries(DESIGN_GROUPS.map((item) => [item.key, new Set<string>()])))
    setStep(0)
  }

  return (
    <div className="mx-auto max-w-[100rem]">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Design Explorer</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Finde deine gestalterische Richtung.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Schritt für Schritt von einer groben Raumidee zu einer klaren Material- und Formensprache.</p>
        </div>
        {selectedSlugs.length > 0 && <Button variant="ghost" onClick={reset}><RotateCcw className="size-4" />Auswahl zurücksetzen</Button>}
      </div>

      <div className="mt-8 grid overflow-hidden rounded-[1.5rem] border border-border bg-card xl:grid-cols-[12.5rem_minmax(25rem,0.85fr)_minmax(28rem,1.15fr)]">
        <aside className="border-b border-border bg-[#eeebe3] p-5 xl:border-b-0 xl:border-r xl:p-6">
          <p className="mb-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dein Weg</p>
          <div className="flex gap-2 overflow-x-auto xl:block xl:space-y-1">
            {DESIGN_GROUPS.map((item, index) => {
              const hasSelection = selections[item.key].size > 0
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setStep(index)}
                  className={cn(
                    'flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition xl:w-full',
                    index === step ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:bg-card/50',
                  )}
                >
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border text-[0.65rem]', index === step && 'border-primary bg-primary text-white', hasSelection && index !== step && 'border-accent bg-accent text-white')}>
                    {hasSelection && index !== step ? <Check className="size-3" /> : index + 1}
                  </span>
                  {item.shortLabel}
                </button>
              )
            })}
          </div>
          <div className="mt-8 hidden rounded-xl bg-card/60 p-4 xl:block">
            <Sparkles className="size-4 text-accent" />
            <p className="mt-3 text-xs font-semibold">Tipp</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Du kannst mehrere Optionen kombinieren und jederzeit zu einem Schritt zurückkehren.</p>
          </div>
        </aside>

        <section className="border-b border-border p-6 sm:p-8 xl:min-h-[45rem] xl:border-b-0 xl:border-r">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-accent">Schritt {step + 1} von {DESIGN_GROUPS.length}</span>
            <span className="text-xs text-muted-foreground">{selections[group.key].size} gewählt</span>
          </div>
          <h2 className="mt-4 max-w-md font-display text-3xl leading-tight sm:text-4xl">{group.label}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{group.description}</p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            {group.options.map((option) => {
              const active = selections[group.key].has(option.slug)
              return (
                <button
                  key={option.slug}
                  type="button"
                  onClick={() => toggle(option.slug)}
                  className={cn(
                    'relative overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5',
                    active ? 'border-primary bg-primary text-white shadow-md' : 'border-border bg-background hover:border-foreground/30',
                    option.swatch && 'min-h-32',
                  )}
                >
                  {option.swatch && <span className="absolute inset-x-0 top-0 h-[4.7rem]" style={{ background: option.swatch }} />}
                  <span className={cn('relative flex items-center justify-between gap-2', option.swatch && 'mt-[4.75rem]')}>
                    <span className="text-sm font-semibold">{option.name}</span>
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border', active ? 'border-white bg-white text-primary' : 'border-border')}>
                      {active && <Check className="size-3" />}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft className="size-4" />Zurück</Button>
            {step < DESIGN_GROUPS.length - 1 ? (
              <Button onClick={() => setStep((value) => value + 1)}>Weiter<ArrowRight className="size-4" /></Button>
            ) : (
              <Button onClick={() => document.getElementById('explorer-results')?.scrollIntoView({ behavior: 'smooth' })}>Ergebnisse ansehen<Compass className="size-4" /></Button>
            )}
          </div>
        </section>

        <section id="explorer-results" className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Live-Auswahl</p>
              <h2 className="mt-1 font-display text-3xl">Passende Inspirationen</h2>
              <p className="mt-2 text-xs text-muted-foreground">{total} Bilder entsprechen deiner Richtung</p>
            </div>
            {selectedSlugs.length > 1 && (
              <div className="flex rounded-lg bg-muted p-1 text-xs">
                <button onClick={() => setMatch('all')} className={cn('rounded-md px-3 py-2', match === 'all' && 'bg-white shadow-sm')}>Exakt</button>
                <button onClick={() => setMatch('any')} className={cn('rounded-md px-3 py-2', match === 'any' && 'bg-white shadow-sm')}>Ähnlich</button>
              </div>
            )}
          </div>

          {selectedOptions.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {selectedOptions.map((option) => <span key={option.slug} className="filter-chip filter-chip-active">{option.name}</span>)}
            </div>
          )}

          <div className="mt-6 max-h-[36rem] overflow-y-auto pr-1">
            {loading ? <LoadingState label="Auswahl wird aktualisiert …" /> : error ? (
              <EmptyState icon={SlidersHorizontal} title="Ergebnisse nicht verfügbar" description={error} />
            ) : images.length ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-7 2xl:grid-cols-3">
                {images.map((image) => <ImageCard key={image.id} image={image} compact onOpen={() => { setSelectedImage(image); setDetailOpen(true) }} onSave={() => { setSelectedImage(image); setSaveOpen(true) }} />)}
              </div>
            ) : (
              <EmptyState icon={Compass} title="Noch keine exakte Inspiration" description="Wechsle zu „Ähnlich“, lockere einzelne Kriterien oder ergänze passende Bilder in der Bibliothek." />
            )}
          </div>
        </section>
      </div>

      <ImageDetailDialog image={selectedImage} open={detailOpen} onOpenChange={setDetailOpen} />
      <AddToMoodboardDialog image={selectedImage} open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}

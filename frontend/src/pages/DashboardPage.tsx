import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Compass, ImagePlus, Images, LayoutDashboard, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import heroImage from '@/assets/design-suite-hero.webp'
import { AddToMoodboardDialog } from '@/components/AddToMoodboardDialog'
import { EmptyState } from '@/components/EmptyState'
import { ImageCard } from '@/components/ImageCard'
import { ImageDetailDialog } from '@/components/ImageDetailDialog'
import { LoadingState } from '@/components/LoadingState'
import { MoodboardCard } from '@/components/MoodboardCard'
import { UploadDialog } from '@/components/UploadDialog'
import { Button } from '@/components/ui/button'
import { listCollections, listImages } from '@/lib/api'
import type { CollectionSummary, ImageSummary } from '@/types'

type DashboardData = {
  images: ImageSummary[]
  imageTotal: number
  publicTotal: number
  boards: CollectionSummary[]
  boardTotal: number
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<ImageSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [images, publicImages, boards] = await Promise.all([
        listImages({ limit: 8 }),
        listImages({ limit: 1, visibility: 'PUBLIC' }),
        listCollections({ limit: 3 }),
      ])
      setData({
        images: images.data,
        imageTotal: images.total,
        publicTotal: publicImages.total,
        boards: boards.data,
        boardTotal: boards.total,
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Übersicht konnte nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    window.addEventListener('images-changed', load)
    window.addEventListener('collections-changed', load)
    return () => {
      window.removeEventListener('images-changed', load)
      window.removeEventListener('collections-changed', load)
    }
  }, [load])

  return (
    <div className="mx-auto max-w-[96rem]">
      <section className="relative min-h-[26rem] overflow-hidden rounded-[1.6rem] bg-[#3a332c] text-white sm:min-h-[29rem]">
        <img src={heroImage} alt="Maßgefertigter Wohnraum aus Eiche" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
        <div className="relative z-10 flex min-h-[26rem] max-w-2xl flex-col justify-center px-7 py-12 sm:min-h-[29rem] sm:px-12 lg:px-16">
          <p className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            <Sparkles className="size-3.5 text-[#dda273]" />
            Von der Idee zum Raumkonzept
          </p>
          <h1 className="font-display text-4xl font-normal leading-[1.05] sm:text-6xl">
            Räume beginnen mit einem Gefühl.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-white/78 sm:text-base">
            Entdecke Gestaltungsideen, schärfe deine Wünsche und entwickle daraus ein persönliches Möbelkonzept.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="h-11 bg-white px-5 text-foreground hover:bg-white/90">
              <Link to="/explorer">
                <Compass className="size-4" />
                Explorer starten
              </Link>
            </Button>
            <Button className="h-11 border border-white/35 bg-white/10 px-5 text-white backdrop-blur hover:bg-white/20" onClick={() => setUploadOpen(true)}>
              <ImagePlus className="size-4" />
              Eigene Inspiration
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error} <button className="ml-2 font-semibold underline" onClick={() => void load()}>Erneut versuchen</button>
        </div>
      )}

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Images} value={data?.imageTotal ?? 0} label="Inspirationen" hint="in deiner Bibliothek" />
        <StatCard icon={LayoutDashboard} value={data?.boardTotal ?? 0} label="Moodboards" hint="aktive Konzepte" />
        <StatCard icon={Sparkles} value={data?.publicTotal ?? 0} label="Freigegeben" hint="bereit zur Präsentation" />
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="Zuletzt hinzugefügt"
          title="Neue Inspirationen"
          action={<Link to="/library" className="section-link">Alle ansehen <ArrowRight className="size-4" /></Link>}
        />
        {loading && !data ? (
          <LoadingState />
        ) : data?.images.length ? (
          <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {data.images.slice(0, 6).map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onOpen={() => {
                  setSelectedImage(image)
                  setDetailOpen(true)
                }}
                onSave={() => {
                  setSelectedImage(image)
                  setSaveOpen(true)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState
              icon={Images}
              title="Deine Bibliothek wartet"
              description="Lade das erste Inspirationsbild hoch. Vorschauen und technische Merkmale werden automatisch erstellt."
              action={<Button onClick={() => setUploadOpen(true)}><ImagePlus className="size-4" />Erstes Bild hochladen</Button>}
            />
          </div>
        )}
      </section>

      <section className="mt-14">
        <SectionHeading
          eyebrow="Deine Konzepte"
          title="Aktuelle Moodboards"
          action={<Link to="/moodboards" className="section-link">Alle Moodboards <ArrowRight className="size-4" /></Link>}
        />
        {data?.boards.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.boards.map((board) => <MoodboardCard key={board.id} board={board} />)}
          </div>
        ) : (
          <button onClick={() => navigate('/moodboards')} className="mt-5 flex w-full items-center justify-between rounded-[1.25rem] border border-dashed border-border bg-card/45 px-6 py-8 text-left hover:bg-card">
            <span>
              <span className="block font-display text-2xl">Ein Konzept zusammenstellen</span>
              <span className="mt-1 block text-sm text-muted-foreground">Sammle Bilder, Notizen und Kundenwünsche an einem Ort.</span>
            </span>
            <ArrowRight className="size-5" />
          </button>
        )}
      </section>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onUploaded={load} />
      <ImageDetailDialog image={selectedImage} open={detailOpen} onOpenChange={setDetailOpen} onChanged={load} />
      <AddToMoodboardDialog image={selectedImage} open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}

function StatCard({ icon: Icon, value, label, hint }: { icon: typeof Images; value: number; label: string; hint: string }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary"><Icon className="size-[1.1rem]" /></span>
      <div>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{label}</span> · {hint}</p>
      </div>
    </article>
  )
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div><p className="eyebrow">{eyebrow}</p><h2 className="mt-1 font-display text-3xl sm:text-4xl">{title}</h2></div>
      {action}
    </div>
  )
}

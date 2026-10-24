import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CreateMoodboardDialog } from '@/components/CreateMoodboardDialog'
import { EmptyState } from '@/components/EmptyState'
import { LoadingState } from '@/components/LoadingState'
import { MoodboardCard } from '@/components/MoodboardCard'
import { Button } from '@/components/ui/button'
import { listCollections } from '@/lib/api'
import type { CollectionSummary } from '@/types'

export function MoodboardsPage() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<CollectionSummary[]>([])
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listCollections({ limit: 100, search: activeSearch })
      setBoards(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Moodboards konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [activeSearch])

  useEffect(() => {
    void load()
    window.addEventListener('collections-changed', load)
    return () => window.removeEventListener('collections-changed', load)
  }, [load])

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Persönliche Moodboards</p>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl">Ideen werden zu Konzepten.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Sammle Bilder, kombiniere Materialien und halte Entscheidungen für jedes Projekt fest.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />Neues Moodboard</Button>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); setActiveSearch(search.trim()) }} className="relative mt-8 max-w-lg">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="field pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Moodboards durchsuchen …" />
      </form>

      <section className="mt-7">
        {loading ? <LoadingState label="Moodboards werden geladen …" /> : error ? (
          <EmptyState icon={LayoutDashboard} title="Moodboards nicht erreichbar" description={error} action={<Button onClick={() => void load()}>Erneut laden</Button>} />
        ) : boards.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {boards.map((board) => <MoodboardCard key={board.id} board={board} />)}
          </div>
        ) : (
          <EmptyState icon={LayoutDashboard} title={activeSearch ? 'Kein passendes Moodboard' : 'Dein erstes Konzept beginnt hier'} description={activeSearch ? 'Prüfe den Suchbegriff oder zeige wieder alle Moodboards.' : 'Lege ein Moodboard für ein Möbel, einen Raum oder ein komplettes Kundenprojekt an.'} action={<Button onClick={() => activeSearch ? setActiveSearch('') : setCreateOpen(true)}>{activeSearch ? 'Alle anzeigen' : 'Moodboard erstellen'}</Button>} />
        )}
      </section>

      <CreateMoodboardDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(id) => navigate(`/moodboards/${id}`)} />
    </div>
  )
}

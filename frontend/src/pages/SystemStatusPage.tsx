import { useCallback, useEffect, useState } from 'react'
import {
  Boxes,
  CheckCircle2,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ApiHealth = {
  status: 'ok' | 'degraded'
  service: string
  services: Record<'database' | 'valkey' | 'storage', 'up' | 'down'>
  timestamp: string
}

type RequestState =
  | { kind: 'loading' }
  | { kind: 'success'; data: ApiHealth }
  | { kind: 'error'; message: string }

const apiBaseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function fetchHealth(signal?: AbortSignal) {
  const response = await fetch(`${apiBaseUrl}/health`, { signal })
  const data = (await response.json()) as ApiHealth
  if (!response.ok && response.status !== 503) {
    throw new Error(`API antwortet mit Status ${response.status}`)
  }
  return data
}

export function SystemStatusPage() {
  const [request, setRequest] = useState<RequestState>({ kind: 'loading' })

  const checkApi = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchHealth(signal)
      setRequest({ kind: 'success', data })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setRequest({
        kind: 'error',
        message: error instanceof Error ? error.message : 'API nicht erreichbar',
      })
    }
  }, [])

  function refresh() {
    setRequest({ kind: 'loading' })
    void checkApi()
  }

  useEffect(() => {
    const controller = new AbortController()
    void fetchHealth(controller.signal).then(
      (data) => setRequest({ kind: 'success', data }),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setRequest({
          kind: 'error',
          message: error instanceof Error ? error.message : 'API nicht erreichbar',
        })
      },
    )
    return () => controller.abort()
  }, [])

  const hasHealthData = request.kind === 'success'
  const allServicesReady = hasHealthData && request.data.status === 'ok'

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Boxes className="size-3.5" />
              Systemcheck
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Möbel Design Suite
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Das technische Grundgerüst für Bildverwaltung, Sammlungen und freie Moodboards ist eingerichtet.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={request.kind === 'loading'}
          >
            <RefreshCw className={cn('size-4', request.kind === 'loading' && 'animate-spin')} />
            Erneut prüfen
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={Database}
            title="PostgreSQL"
            status={hasHealthData ? request.data.services.database : undefined}
            detail="Prisma 7 + pg-Adapter"
          />
          <StatusCard
            icon={HardDrive}
            title="Garage S3"
            status={hasHealthData ? request.data.services.storage : undefined}
            detail="Private Objekte + Presigned URLs"
          />
          <StatusCard
            icon={Server}
            title="Valkey"
            status={hasHealthData ? request.data.services.valkey : undefined}
            detail="BullMQ Bildverarbeitung"
          />
        </section>

        <section className="mt-6 rounded-lg border border-border bg-card p-5 shadow-[0_18px_60px_rgba(52,49,43,0.07)]">
          <div className="flex items-start gap-3">
            {allServicesReady ? (
              <CheckCircle2 className="mt-0.5 size-5 text-primary" />
            ) : request.kind === 'error' || request.kind === 'success' ? (
              <XCircle className="mt-0.5 size-5 text-red-700" />
            ) : (
              <RefreshCw className="mt-0.5 size-5 animate-spin text-muted-foreground" />
            )}
            <div>
              <h2 className="font-medium">
                {request.kind === 'success'
                  ? allServicesReady
                    ? 'Backend ist einsatzbereit'
                    : 'Backend erreichbar, Dienste noch nicht bereit'
                  : request.kind === 'error'
                    ? 'Backend noch nicht erreichbar'
                    : 'Backend wird geprüft'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {request.kind === 'success'
                  ? `Letzte Prüfung: ${new Date(request.data.timestamp).toLocaleString('de-DE')}`
                  : request.kind === 'error'
                    ? `${request.message}. Prüfe die zentrale .env und Docker-Services.`
                    : 'Datenbank, Objektspeicher und Job-Queue werden abgefragt.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function StatusCard({
  icon: Icon,
  title,
  status,
  detail,
}: {
  icon: typeof Database
  title: string
  status?: 'up' | 'down'
  detail: string
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <Icon className="size-5 text-primary" />
        <span
          className={cn(
            'rounded-full px-2 py-1 text-xs font-medium',
            status === 'up' && 'bg-green-100 text-green-800',
            status === 'down' && 'bg-red-100 text-red-800',
            !status && 'bg-muted text-muted-foreground',
          )}
        >
          {status === 'up' ? 'Verbunden' : status === 'down' ? 'Fehler' : 'Ungeprüft'}
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </article>
  )
}

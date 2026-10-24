import { useEffect, useState } from 'react'
import { ArrowRight, Building2, KeyRound, LoaderCircle, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import hero from '@/assets/design-suite-hero.webp'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { exchangePublicKey, getLoginMode, loginPublic } from '@/lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, session } = useAuth()
  const [mode, setMode] = useState<'company' | 'public'>('company')
  const [checkingMode, setCheckingMode] = useState(true)
  const [company, setCompany] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [navigate, session])

  useEffect(() => {
    let active = true
    const query = new URLSearchParams(window.location.search)
    const publicKey = query.get('publicKey') || query.get('key')
    async function resolveMode() {
      try {
        const result = publicKey ? await exchangePublicKey(publicKey) : await getLoginMode()
        if (active) setMode(result.mode)
        if (publicKey) {
          query.delete('publicKey')
          query.delete('key')
          const clean = `${window.location.pathname}${query.size ? `?${query}` : ''}${window.location.hash}`
          window.history.replaceState({}, '', clean)
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Zugangslink konnte nicht geprüft werden.')
      } finally {
        if (active) setCheckingMode(false)
      }
    }
    void resolveMode()
    return () => { active = false }
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'public') {
        await loginPublic({ email, password })
      } else {
        const next = await login({ company, login: username, password })
        const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
        navigate(next.license.status === 'active' ? from || '/' : '/settings', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-[#ece8df] lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden lg:block">
        <img src={hero} alt="Maßgefertigter Wohnraum aus Holz" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#19221d]/90 via-[#223229]/20 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 p-14 text-white xl:p-20">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Wiest Design Suite</p>
          <h1 className="mt-5 max-w-2xl font-display text-5xl font-normal leading-[1.02] xl:text-6xl">
            Von der ersten Idee zum stimmigen Raumkonzept.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/75">
            Inspirationen entdecken, gemeinsam bewerten und in persönliche Entwürfe übersetzen.
          </p>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-primary font-semibold text-white shadow-sm">W</span>
            <div>
              <p className="font-semibold tracking-[0.06em]">WIEST</p>
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Design Suite</p>
            </div>
          </div>

          <div className="mt-12 rounded-[1.6rem] border border-white/70 bg-card/95 p-6 shadow-[0_28px_80px_rgba(52,43,32,0.12)] sm:p-9">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-muted text-primary">
                {mode === 'public' ? <UserRound className="size-4" /> : <Building2 className="size-4" />}
              </span>
              <div>
                <p className="eyebrow">{mode === 'public' ? 'Öffentlicher Zugang' : 'Firmenzugang'}</p>
                <h2 className="mt-1 font-display text-3xl font-normal">Willkommen zurück</h2>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {mode === 'public'
                ? 'Melde dich als Endkunde an, um freigegebene Inspirationen zu entdecken.'
                : 'Verwende dieselben Zugangsdaten wie in Carpenters Production.'}
            </p>

            {checkingMode ? (
              <div className="mt-9 flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Zugang wird geprüft …</div>
            ) : (
              <form onSubmit={submit} className="mt-8 space-y-5">
                {mode === 'company' ? (
                  <>
                    <LoginField icon={Building2} label="Firma oder Tenant-Slug" value={company} onChange={setCompany} autoComplete="organization" />
                    <LoginField icon={UserRound} label="Benutzer" value={username} onChange={setUsername} autoComplete="username" />
                  </>
                ) : (
                  <LoginField icon={Mail} label="E-Mail-Adresse" type="email" value={email} onChange={setEmail} autoComplete="email" />
                )}
                <LoginField icon={LockKeyhole} label="Passwort" type="password" value={password} onChange={setPassword} autoComplete="current-password" />

                {mode === 'public' && (
                  <div className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    Die öffentliche Benutzer-Datenbank ist vorbereitet, aber noch nicht angebunden. Registrierung und Anmeldung folgen separat.
                  </div>
                )}
                {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

                <Button type="submit" className="h-12 w-full" disabled={submitting || mode === 'public'}>
                  {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  {mode === 'public' ? 'Öffentliche Anmeldung folgt' : submitting ? 'Anmeldung wird geprüft …' : 'Sicher anmelden'}
                  {!submitting && mode === 'company' && <ArrowRight className="ml-auto size-4" />}
                </Button>
              </form>
            )}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">Zugriff und Funktionsumfang werden über die Firmenlizenz geprüft.</p>
        </div>
      </section>
    </main>
  )
}

function LoginField({ icon: Icon, label, type = 'text', value, onChange, autoComplete }: {
  icon: typeof Building2
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className="field pl-10" type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required />
      </span>
    </label>
  )
}

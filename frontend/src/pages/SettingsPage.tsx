import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { BadgeCheck, Building2, Database, ImageIcon, KeyRound, LoaderCircle, LogOut, Save, Settings2, ShieldCheck, Tags, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { activateLicense, getSettingsOverview, getTagProposals, getTagSuggestions, getTenantSettings, proposeTag, updateTenantSettings } from '@/lib/api'
import { CATEGORY_LABELS } from '@/lib/design-options'
import type { TagCategory, TagProposal, TagSuggestion, TenantSettings } from '@/types'

const categoryOptions = Object.keys(CATEGORY_LABELS) as TagCategory[]

export function SettingsPage() {
  const navigate = useNavigate()
  const { session, logout, refresh } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [overview, setOverview] = useState<{ images: number; sharedImages: number; tags: number; pendingTags: number } | null>(null)
  const [proposals, setProposals] = useState<TagProposal[]>([])
  const [tagName, setTagName] = useState('')
  const [tagCategory, setTagCategory] = useState<TagCategory>('FEATURE')
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([])
  const [saving, setSaving] = useState(false)

  const canSeeManagement = Boolean(session?.permissions.viewLicense)
  const activeLicense = session?.license.status === 'active'

  useEffect(() => {
    if (!session || !activeLicense || !canSeeManagement) return
    void Promise.all([
      getSettingsOverview().then(setOverview),
      getTenantSettings().then(setSettings),
      session.permissions.proposeTags ? getTagProposals().then((result) => setProposals(result.data)) : Promise.resolve(),
    ]).catch((caught) => setMessage(caught instanceof Error ? caught.message : 'Einstellungen konnten nicht geladen werden.'))
  }, [activeLicense, canSeeManagement, session])

  if (!session) return null
  const { user, license, permissions } = session

  async function handleLogout() {
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  async function handleActivation(event: React.FormEvent) {
    event.preventDefault()
    setActivating(true)
    setMessage(null)
    try {
      await activateLicense(licenseKey)
      setLicenseKey('')
      await refresh()
      setMessage('Lizenz wurde geprüft und aktualisiert.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Lizenz konnte nicht aktiviert werden.')
    } finally {
      setActivating(false)
    }
  }

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setMessage(null)
    try {
      const input = permissions.usePublicContent
        ? settings
        : { ...settings, defaultVisibility: 'PRIVATE' as const, showExternalImages: false }
      setSettings(await updateTenantSettings(input))
      setMessage('Oberflächeneinstellungen wurden gespeichert.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Einstellungen konnten nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  async function checkTag() {
    if (tagName.trim().length < 2) return
    try {
      const result = await getTagSuggestions(tagName.trim(), tagCategory)
      setSuggestions(result.data)
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Tag-Vergleich fehlgeschlagen.')
    }
  }

  async function submitTag() {
    setSaving(true)
    setMessage(null)
    try {
      await proposeTag({ name: tagName.trim(), category: tagCategory })
      const result = await getTagProposals()
      setProposals(result.data)
      setTagName('')
      setSuggestions([])
      setMessage('Der Tag wurde zur globalen Prüfung eingereicht.')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Tag-Vorschlag konnte nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Konto & Konfiguration</p>
          <h1 className="mt-2 font-display text-4xl font-normal">Benutzereinstellungen</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Persönliche Daten, Lizenzstatus und mandantenbezogene Design-Suite-Einstellungen.</p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold">
          <ShieldCheck className="size-4 text-primary" /> {roleLabel(user.role)}
        </span>
      </div>

      {message && <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm">{message}</div>}
      {!activeLicense && !canSeeManagement && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Die Design-Suite-Lizenz ist nicht aktiv. Bitte wende dich an einen Administrator deiner Firma.
        </div>
      )}

      <Tabs defaultValue="account" className="mt-8">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="account">Benutzer</TabsTrigger>
          {canSeeManagement && <TabsTrigger value="license">Lizenz</TabsTrigger>}
          {canSeeManagement && activeLicense && <TabsTrigger value="library">Bilddaten</TabsTrigger>}
          {permissions.proposeTags && activeLicense && <TabsTrigger value="tags">Tags</TabsTrigger>}
        </TabsList>

        <TabsContent value="account" className="mt-6 space-y-5">
          <Panel title="Angemeldeter Benutzer" icon={UserRound}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Data label="Benutzername" value={user.login} />
              <Data label="E-Mail-Adresse" value={user.email} />
              <Data label="Firma" value={user.tenant.name} />
              <Data label="Tenant-Slug" value={user.tenant.slug} />
              <Data label="Rolle" value={roleLabel(user.role)} />
              <Data label="Benutzerquelle" value={user.provider === 'carpenters' ? 'Carpenters Production' : 'Öffentlich'} />
            </dl>
          </Panel>
          <Panel title="Sitzung" icon={LogOut}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Beendet die Sitzung der Design Suite auf diesem Gerät.</p>
              <Button variant="outline" onClick={() => void handleLogout()} disabled={loggingOut}>
                {loggingOut ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />} Abmelden
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="license" className="mt-6 space-y-5">
          <Panel title="Design-Suite-Lizenz" icon={BadgeCheck}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Data label="Status" value={licenseStatusLabel(license.status)} />
              <Data label="Tarif" value={license.plan || '—'} />
              <Data label="Benutzerlimit" value={license.maxUsers ? String(license.maxUsers) : 'Unbegrenzt'} />
              <Data label="Gültig bis" value={license.validUntil ? new Intl.DateTimeFormat('de-DE').format(new Date(license.validUntil)) : 'Unbefristet'} />
            </div>
            {license.status !== 'active' && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Die Gestaltungsfunktionen bleiben gesperrt, bis die Lizenz aktiv ist.</p>}
          </Panel>
          {permissions.manageLicense && (
            <Panel title="Lizenz aktualisieren" icon={KeyRound}>
              <form onSubmit={handleActivation} className="flex flex-col gap-3 sm:flex-row">
                <input className="field flex-1" type="password" value={licenseKey} onChange={(event) => setLicenseKey(event.target.value)} placeholder="Lizenzschlüssel einfügen" required />
                <Button type="submit" disabled={activating}>{activating && <LoaderCircle className="size-4 animate-spin" />} Lizenz aktivieren</Button>
              </form>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="library" className="mt-6 space-y-5">
          {overview && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={ImageIcon} value={overview.images} label="Eigene Bilder" />
              <Stat icon={Building2} value={overview.sharedImages} label="Extern freigegeben" />
              <Stat icon={Tags} value={overview.tags} label="Globale Tags" />
              <Stat icon={Database} value={overview.pendingTags} label="Offene Vorschläge" />
            </div>
          )}
          <Panel title="Darstellung der Bildbibliothek" icon={Settings2}>
            {settings && (
              <div className="grid gap-5 sm:grid-cols-2">
                <label><span className="field-label">Ansichtsdichte</span><select className="field" value={settings.libraryDensity} onChange={(event) => setSettings({ ...settings, libraryDensity: event.target.value as TenantSettings['libraryDensity'] })} disabled={!permissions.manageCompanySettings}><option value="COMFORTABLE">Großzügig</option><option value="COMPACT">Kompakt</option></select></label>
                <label><span className="field-label">Standard-Freigabe beim Upload</span><select className="field" value={permissions.usePublicContent ? settings.defaultVisibility : 'PRIVATE'} onChange={(event) => setSettings({ ...settings, defaultVisibility: event.target.value as TenantSettings['defaultVisibility'] })} disabled={!permissions.manageCompanySettings || !permissions.usePublicContent}><option value="PRIVATE">Nur eigene Firma</option>{permissions.usePublicContent && <option value="RESTRICTED">Andere Firmen</option>}{permissions.usePublicContent && <option value="PUBLIC">Öffentlich</option>}</select></label>
                {permissions.usePublicContent && <label className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm"><input type="checkbox" checked={settings.showExternalImages} onChange={(event) => setSettings({ ...settings, showExternalImages: event.target.checked })} disabled={!permissions.manageCompanySettings} /> Freigegebene Bilder anderer Firmen in Suche und Explorer anzeigen</label>}
                {permissions.manageCompanySettings && <div className="sm:col-span-2 flex justify-end"><Button onClick={() => void saveSettings()} disabled={saving}><Save className="size-4" /> Speichern</Button></div>}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="tags" className="mt-6 space-y-5">
          <Panel title="Neuen globalen Tag vorschlagen" icon={Tags}>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
              <input className="field" value={tagName} onChange={(event) => { setTagName(event.target.value); setSuggestions([]) }} placeholder="Begriff, z. B. geräucherte Eiche" />
              <select className="field" value={tagCategory} onChange={(event) => setTagCategory(event.target.value as TagCategory)}>{categoryOptions.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}</select>
              <Button variant="outline" onClick={() => void checkTag()} disabled={tagName.trim().length < 2}>Vergleichen</Button>
            </div>
            {suggestions.length > 0 ? (
              <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenantübergreifende Treffer</p>
                <div className="mt-3 flex flex-wrap gap-2">{suggestions.map((item) => <span key={item.id} className="rounded-full bg-card px-3 py-2 text-xs"><strong>{item.name}</strong>{item.aliases.length ? ` · ${item.aliases.join(', ')}` : ''} · {Math.round(item.score * 100)} %</span>)}</div>
              </div>
            ) : tagName.trim().length >= 2 && <p className="mt-4 text-xs text-muted-foreground">Vor dem Einreichen bitte „Vergleichen“ wählen.</p>}
            <div className="mt-5 flex justify-end"><Button onClick={() => void submitTag()} disabled={saving || tagName.trim().length < 2 || suggestions.some((item) => item.exact)}>Zur Prüfung einreichen</Button></div>
          </Panel>
          <Panel title="Tag-Vorschläge" icon={Database}>
            <div className="divide-y divide-border">{proposals.length ? proposals.map((proposal) => <div key={proposal.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold">{proposal.proposedName}</p><p className="mt-1 text-xs text-muted-foreground">{CATEGORY_LABELS[proposal.category]} · {new Intl.DateTimeFormat('de-DE').format(new Date(proposal.createdAt))}</p></div><span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold">{proposalStatus(proposal.status)}</span></div>) : <p className="py-3 text-sm text-muted-foreground">Noch keine Vorschläge vorhanden.</p>}</div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof UserRound; children: ReactNode }) {
  return <section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-muted"><Icon className="size-4" /></span><h2 className="font-display text-2xl font-normal">{title}</h2></div>{children}</section>
}
function Data({ label, value }: { label: string; value: string }) { return <div><dt className="field-label">{label}</dt><dd className="text-sm font-semibold">{value}</dd></div> }
function Stat({ icon: Icon, value, label }: { icon: typeof ImageIcon; value: number; label: string }) { return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="size-4 text-accent" /><p className="mt-4 font-display text-3xl">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div> }
function roleLabel(role: string) { return ({ admin: 'Administrator', manager: 'Manager', user: 'Benutzer', public: 'Öffentlicher Benutzer' } as Record<string, string>)[role] || role }
function licenseStatusLabel(status: string) { return ({ active: 'Aktiv', inactive: 'Inaktiv', expired: 'Abgelaufen', suspended: 'Gesperrt', revoked: 'Widerrufen', missing: 'Nicht eingerichtet' } as Record<string, string>)[status] || status }
function proposalStatus(status: TagProposal['status']) { return ({ PENDING: 'In Prüfung', APPROVED: 'Freigegeben', MERGED: 'Zusammengeführt', REJECTED: 'Abgelehnt' } as const)[status] }

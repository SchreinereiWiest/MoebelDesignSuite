import { useState } from 'react'
import {
  Bell,
  Compass,
  Home,
  Images,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Upload,
  Settings,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { UploadDialog } from '@/components/UploadDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-context'
import type { Permissions } from '@/types'

const navigation: Array<{ label: string; to: string; icon: typeof Home; end?: boolean; requiredPermission?: keyof Permissions }> = [
  { label: 'Übersicht', to: '/', icon: Home, end: true },
  { label: 'Inspirationen', to: '/library', icon: Images },
  { label: 'Design Explorer', to: '/explorer', icon: Compass },
  { label: 'Moodboards', to: '/moodboards', icon: LayoutDashboard, requiredPermission: 'useMoodboards' },
  { label: 'Kundenberatung', to: '/consultation', icon: MessageSquareText, requiredPermission: 'useMoodboards' },
]

export function AppShell() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const { session } = useAuth()
  const user = session!.user
  const visibleNavigation = navigation.filter((item) => !item.requiredPermission || session!.permissions[item.requiredPermission])
  const initials = (user.login || user.email).slice(0, 2).toUpperCase()

  function submitSearch(event: React.FormEvent) {
    event.preventDefault()
    navigate(search.trim() ? `/library?search=${encodeURIComponent(search.trim())}` : '/library')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border/80 bg-[#eeebe3] lg:flex">
        <div className="flex h-24 items-center px-7">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-lg bg-primary text-sm font-semibold text-white shadow-sm">W</span>
            <span>
              <span className="block text-base font-semibold tracking-[0.04em]">WIEST</span>
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Design Suite</span>
            </span>
          </NavLink>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-4" aria-label="Hauptnavigation">
          <p className="mb-3 px-3 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Arbeitsbereiche</p>
          {visibleNavigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition',
                  'hover:bg-white/70 hover:text-foreground',
                  isActive && 'bg-card text-foreground shadow-[0_5px_18px_rgba(49,42,32,0.05)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-[1.1rem]', isActive && 'text-accent')} strokeWidth={1.8} />
                  {label}
                  {isActive && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4">
          <NavLink to="/settings" className="group flex items-center gap-3 rounded-xl border-t border-border px-2 pt-4 transition hover:text-accent">
            <span className="grid size-9 place-items-center rounded-full bg-[#394c40] text-xs font-semibold text-white">{initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.login}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.tenant.name} · {roleLabel(user.role)}</span>
            </span>
            <Settings className="ml-auto size-4 text-muted-foreground transition group-hover:rotate-12" />
          </NavLink>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-9">
          <NavLink to="/" className="mr-1 flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-xs font-semibold text-white">W</span>
            <span className="hidden text-sm font-semibold tracking-wider sm:block">WIEST</span>
          </NavLink>
          <form onSubmit={submitSearch} className="relative max-w-xl flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-xl border border-transparent bg-card pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/15"
              placeholder="Inspirationen, Materialien oder Stile suchen …"
              aria-label="Inspirationen durchsuchen"
            />
          </form>
          <button type="button" className="relative hidden size-10 place-items-center rounded-full hover:bg-card sm:grid" aria-label="Benachrichtigungen">
            <Bell className="size-[1.1rem]" />
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
          </button>
          {session?.permissions.uploadImages && (
            <Button onClick={() => setUploadOpen(true)} className="h-10 px-3 sm:px-4">
              <Upload className="size-4" />
              <span className="hidden sm:inline">Bild hochladen</span>
            </Button>
          )}
          <NavLink to="/settings" className="grid size-10 place-items-center rounded-full bg-card lg:hidden" aria-label="Benutzereinstellungen">
            <span className="text-xs font-semibold">{initials}</span>
          </NavLink>
        </header>

        <main className="min-h-[calc(100vh-5rem)] px-4 pb-28 pt-7 sm:px-6 lg:px-9 lg:pb-10 lg:pt-9">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-3 bottom-3 z-40 flex h-16 items-center justify-around rounded-2xl border border-border bg-card/95 px-2 shadow-[0_16px_55px_rgba(32,28,23,0.18)] backdrop-blur lg:hidden" aria-label="Mobile Navigation">
        {visibleNavigation.slice(0, 5).map(({ label, to, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn('flex min-w-14 flex-col items-center gap-1 text-[0.6rem] font-medium text-muted-foreground', isActive && 'text-foreground')}
          >
            {({ isActive }) => (
              <>
                <span className={cn('grid size-8 place-items-center rounded-lg', isActive && 'bg-primary text-white')}>
                  <Icon className="size-4" />
                </span>
                <span className="max-w-16 truncate">{label === 'Kundenberatung' ? 'Beratung' : label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {session?.permissions.uploadImages && (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploaded={() => navigate('/library')}
        />
      )}
    </div>
  )
}

function roleLabel(role: string) {
  return ({ admin: 'Admin', manager: 'Manager', user: 'Benutzer', public: 'Öffentlich' } as Record<string, string>)[role] || role
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getCurrentSession, loginCompany, logout as logoutRequest } from '@/lib/api'
import type { AuthSession } from '@/types'
import { AuthContext } from '@/features/auth/auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setSession(await getCurrentSession())
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void getCurrentSession()
      .then((next) => { if (active) setSession(next) })
      .catch(() => { if (active) setSession(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const login = useCallback(async (input: { company: string; login: string; password: string }) => {
    const next = await loginCompany(input)
    setSession(next)
    return next
  }, [])

  const logout = useCallback(async () => {
    try { await logoutRequest() } finally { setSession(null) }
  }, [])

  const value = useMemo(() => ({ session, loading, login, logout, refresh, setSession }), [session, loading, login, logout, refresh])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

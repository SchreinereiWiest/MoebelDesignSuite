import { createContext, useContext } from 'react'
import type { AuthSession } from '@/types'

export type AuthContextValue = {
  session: AuthSession | null
  loading: boolean
  login: (input: { company: string; login: string; password: string }) => Promise<AuthSession>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  setSession: (session: AuthSession | null) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

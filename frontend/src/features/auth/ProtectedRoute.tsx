import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/LoadingState'
import { useAuth } from '@/features/auth/auth-context'

type ProtectedRouteProps = {
  children: ReactNode
  requireLicense?: boolean
  requiredFeature?: string
}

export function ProtectedRoute({ children, requireLicense = true, requiredFeature }: ProtectedRouteProps) {
  const location = useLocation()
  const { session, loading } = useAuth()

  if (loading) return <LoadingState label="Sitzung wird geprüft …" />

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (requireLicense && session.license.status !== 'active') {
    return <Navigate to="/settings" replace />
  }

  if (requiredFeature && !session.license.features.includes(requiredFeature)) {
    return <Navigate to="/" replace />
  }

  return children
}

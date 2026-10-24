import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const isAuthenticated = sessionStorage.getItem('mds-session') === 'authenticated'

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

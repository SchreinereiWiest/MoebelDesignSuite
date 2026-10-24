import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { LoadingState } from '@/components/LoadingState'
import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ExplorerPage = lazy(() => import('@/pages/ExplorerPage').then((module) => ({ default: module.ExplorerPage })))
const MoodboardsPage = lazy(() => import('@/pages/MoodboardsPage').then((module) => ({ default: module.MoodboardsPage })))
const MoodboardEditorPage = lazy(() => import('@/pages/MoodboardEditorPage').then((module) => ({ default: module.MoodboardEditorPage })))
const ConsultationPage = lazy(() => import('@/pages/ConsultationPage').then((module) => ({ default: module.ConsultationPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((module) => ({ default: module.LoginPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Design Suite wird geladen …" />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="moodboards" element={<ProtectedRoute requiredFeature="moodboards"><MoodboardsPage /></ProtectedRoute>} />
          <Route path="moodboards/:id" element={<ProtectedRoute requiredFeature="moodboards"><MoodboardEditorPage /></ProtectedRoute>} />
          <Route path="consultation" element={<ProtectedRoute requiredFeature="moodboards"><ConsultationPage /></ProtectedRoute>} />
        </Route>
        <Route path="/settings" element={<ProtectedRoute requireLicense={false}><AppShell /></ProtectedRoute>}>
          <Route index element={<SettingsPage />} />
        </Route>
        <Route path="/app/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

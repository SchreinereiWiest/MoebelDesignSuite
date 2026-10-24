import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { LoadingState } from '@/components/LoadingState'

const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const LibraryPage = lazy(() => import('@/pages/LibraryPage').then((module) => ({ default: module.LibraryPage })))
const ExplorerPage = lazy(() => import('@/pages/ExplorerPage').then((module) => ({ default: module.ExplorerPage })))
const MoodboardsPage = lazy(() => import('@/pages/MoodboardsPage').then((module) => ({ default: module.MoodboardsPage })))
const MoodboardEditorPage = lazy(() => import('@/pages/MoodboardEditorPage').then((module) => ({ default: module.MoodboardEditorPage })))
const ConsultationPage = lazy(() => import('@/pages/ConsultationPage').then((module) => ({ default: module.ConsultationPage })))

export default function App() {
  return (
    <Suspense fallback={<LoadingState label="Design Suite wird geladen …" />}>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="moodboards" element={<MoodboardsPage />} />
          <Route path="moodboards/:id" element={<MoodboardEditorPage />} />
          <Route path="consultation" element={<ConsultationPage />} />
        </Route>
        <Route path="/app/*" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

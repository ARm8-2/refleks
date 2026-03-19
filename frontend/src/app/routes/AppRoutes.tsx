import { AppLayout } from '@/app/layout'
import { Loading } from '@/shared/components'
import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

// Lazy load feature pages for code splitting
const OverviewPage = lazy(() => import('@/features/overview').then(m => ({ default: m.OverviewPage })))
const HistoryPage = lazy(() => import('@/features/history').then(m => ({ default: m.HistoryPage })))
const BenchmarksExplorePage = lazy(() => import('@/features/benchmarks').then(m => ({ default: m.BenchmarksExplorePage })))
const BenchmarkDetailPage = lazy(() => import('@/features/benchmarks').then(m => ({ default: m.BenchmarkDetailPage })))
const SettingsPage = lazy(() => import('@/features/settings').then(m => ({ default: m.SettingsPage })))

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="benchmarks" element={<BenchmarksExplorePage />} />
          <Route path="benchmarks/:id" element={<BenchmarkDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

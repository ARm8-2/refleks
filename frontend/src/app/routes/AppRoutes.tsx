import { AppLayout } from '@/app/layout'
import { OverviewPage } from '@/features/overview'
import { readLastRoute } from '@/shared/lib/navigation'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const loadHistoryFeature = () => import('@/features/history')
const loadBenchmarksFeature = () => import('@/features/benchmarks')
const loadSettingsFeature = () => import('@/features/settings')

const HistoryPage = lazy(() => loadHistoryFeature().then(m => ({ default: m.HistoryPage })))
const BenchmarksExplorePage = lazy(() => loadBenchmarksFeature().then(m => ({ default: m.BenchmarksExplorePage })))
const BenchmarkDetailPage = lazy(() => loadBenchmarksFeature().then(m => ({ default: m.BenchmarkDetailPage })))
const SettingsPage = lazy(() => loadSettingsFeature().then(m => ({ default: m.SettingsPage })))

function RouteLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <div className="h-5 w-44 animate-pulse rounded-md bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-surface-subtle" />
      <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="animate-pulse rounded-xl bg-surface-subtle" />
        <div className="animate-pulse rounded-xl bg-surface-subtle" />
      </div>
    </div>
  )
}

function DelayedRouteFallback() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timerId = window.setTimeout(() => setVisible(true), 120)
    return () => window.clearTimeout(timerId)
  }, [])

  if (!visible) {
    return <div className="h-full min-h-0" />
  }

  return <RouteLoading />
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DelayedRouteFallback />}>{children}</Suspense>
}

function IndexRoute() {
  const lastRoute = readLastRoute()
  if (lastRoute && lastRoute !== '/') {
    return <Navigate to={lastRoute} replace />
  }
  return <OverviewPage />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<IndexRoute />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="history" element={<RouteSuspense><HistoryPage /></RouteSuspense>} />
        <Route path="benchmarks" element={<RouteSuspense><BenchmarksExplorePage /></RouteSuspense>} />
        <Route path="benchmarks/:id" element={<RouteSuspense><BenchmarkDetailPage /></RouteSuspense>} />
        <Route path="settings" element={<RouteSuspense><SettingsPage /></RouteSuspense>} />
      </Route>
    </Routes>
  )
}

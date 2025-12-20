import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary'
import { AppLayout } from './components/layout/AppLayout'
import { Loading } from './components/shared/Loading'
import { StoreProvider } from './hooks/useStore'
import { applyFont, applyTheme, getSavedFont, getSavedTheme } from './lib/theme'

const BenchmarksPage = lazy(() => import('./pages/Benchmarks').then(m => ({ default: m.BenchmarksPage })))
const ScenariosPage = lazy(() => import('./pages/Scenarios').then(m => ({ default: m.ScenariosPage })))
const SessionsPage = lazy(() => import('./pages/Sessions').then(m => ({ default: m.SessionsPage })))
const SettingsPage = lazy(() => import('./pages/Settings').then(m => ({ default: m.SettingsPage })))

export default function App() {
  // Simple theme bootstrap: read localStorage and set class on <html>.
  useEffect(() => {
    applyTheme(getSavedTheme())
    applyFont(getSavedFont())
  }, [])

  return (
    <StoreProvider>
      <AppErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<SessionsPage />} />
              <Route path="scenarios" element={<ScenariosPage />} />
              <Route path="benchmarks" element={<BenchmarksPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </StoreProvider>
  )
}

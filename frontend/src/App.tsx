import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppErrorBoundary } from './components/layout/AppErrorBoundary'
import { AppLayout } from './components/layout/AppLayout'
import { StoreProvider } from './hooks/useStore'
import { applyFont, applyTheme, getSavedFont, getSavedTheme } from './lib/theme'
import { BenchmarksPage } from './pages/Benchmarks'
import { ScenariosPage } from './pages/Scenarios'
import { SessionsPage } from './pages/Sessions'
import { SettingsPage } from './pages/Settings'

export default function App() {
  // Simple theme bootstrap: read localStorage and set class on <html>.
  useEffect(() => {
    applyTheme(getSavedTheme())
    applyFont(getSavedFont())
  }, [])

  return (
    <StoreProvider>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<SessionsPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="benchmarks" element={<BenchmarksPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AppErrorBoundary>
    </StoreProvider>
  )
}

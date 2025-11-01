import { useLocation } from 'react-router-dom'
import { useUIState } from './useUIState'

// Persist UI state per page automatically by keying off the current route path.
// - scope 'path' (default): state is scoped to pathname only (e.g., '/benchmarks')
// - scope 'path+search': include search string as part of the scope (useful when state depends on query)
// - scope 'global': no route scoping; behaves like useUIState for global prefs
export function usePageState<T>(subKey: string, initial: T, opts?: { scope?: 'path' | 'path+search' | 'global' }) {
  const loc = useLocation()
  const scope = opts?.scope ?? 'path'
  const base = scope === 'global' ? 'global' : (scope === 'path+search' ? (loc.pathname + loc.search) : loc.pathname)
  const key = `page:${base}:${subKey}`
  return useUIState<T>(key, initial)
}

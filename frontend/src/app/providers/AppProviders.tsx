import type { ReactNode } from 'react'
import { BenchmarkProvider } from '../../shared/hooks/useBenchmarks'
import { StoreProvider } from '../../shared/hooks/useStore'

interface AppProvidersProps {
  children: ReactNode
}

/**
 * Wraps all application-level context providers.
 * Add new providers here as needed (e.g., theme, auth, etc.)
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StoreProvider>
      <BenchmarkProvider>
        {children}
      </BenchmarkProvider>
    </StoreProvider>
  )
}

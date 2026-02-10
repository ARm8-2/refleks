import type { ReactNode } from 'react'
import { BenchmarkProvider, StoreProvider } from '../../shared/hooks'

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StoreProvider>
      <BenchmarkProvider>
        {children}
      </BenchmarkProvider>
    </StoreProvider>
  )
}

import { BenchmarkProvider, StoreProvider } from "@/shared/hooks";
import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <StoreProvider>
      <BenchmarkProvider>{children}</BenchmarkProvider>
    </StoreProvider>
  );
}

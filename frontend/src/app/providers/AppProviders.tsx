import { I18nProvider } from "@/shared/lib/i18n";
import { BenchmarkProvider, StoreProvider } from "@/shared/hooks";
import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <I18nProvider>
      <StoreProvider>
        <BenchmarkProvider>{children}</BenchmarkProvider>
      </StoreProvider>
    </I18nProvider>
  );
}

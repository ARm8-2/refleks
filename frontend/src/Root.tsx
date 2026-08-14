import { useEffect } from "react";
import { AppProviders, AppRoutes } from "@/app";
import { ErrorBoundary } from "@/shared/components";
import {
  applyFont,
  applyScale,
  getSavedFont,
  getSavedScale,
} from "@/shared/lib";

export default function Root() {
  // Simple bootstrap: read localStorage and set font/scale on <html>.
  // Theme (including the custom stylesheet) is applied earlier in main.tsx
  // so the first paint already shows the right colors.
  useEffect(() => {
    applyFont(getSavedFont());
    applyScale(getSavedScale());
  }, []);

  return (
    <AppProviders>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppProviders>
  );
}

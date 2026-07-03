import { useEffect } from "react";
import { AppProviders, AppRoutes } from "@/app";
import { ErrorBoundary } from "@/shared/components";
import {
  applyFont,
  applyTheme,
  getSavedFont,
  getSavedTheme,
} from "@/shared/lib";

export default function Root() {
  // Simple theme bootstrap: read localStorage and set class on <html>
  useEffect(() => {
    applyTheme(getSavedTheme());
    applyFont(getSavedFont());
  }, []);

  return (
    <AppProviders>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AppProviders>
  );
}

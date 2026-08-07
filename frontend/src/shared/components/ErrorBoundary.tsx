import { Component, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack?: string;
}

interface ErrorFallbackProps {
  error: Error;
  componentStack?: string;
  showDiagnostics?: boolean;
  onDismiss: () => void;
}

export function ErrorFallback({
  error,
  componentStack,
  showDiagnostics = import.meta.env.DEV,
  onDismiss,
}: ErrorFallbackProps) {
  const { t } = useTranslation(["errors", "common"]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6 text-foreground">
      <div className="w-full max-w-xl space-y-3 rounded-xl bg-surface p-4 shadow-md">
        <div className="text-lg font-semibold">{t("errors:generic.title")}</div>
        <div className="text-sm text-surface-muted-foreground">
          {t("errors:generic.unexpected")}
        </div>
        {showDiagnostics && (
          <details className="rounded border bg-surface-muted p-2 text-[11px] text-surface-muted-foreground">
            <summary className="cursor-pointer font-medium">
              {t("errors:generic.developmentDetails")}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">
              {[error.message, error.stack, componentStack].filter(Boolean).join("\n\n")}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary-hover"
            onClick={() => window.location.reload()}
          >
            {t("common:actions.reload")}
          </button>
          <button
            className="rounded-xl bg-surface px-3 py-1.5 text-sm text-surface-muted-foreground hover:bg-surface-muted hover:text-foreground"
            onClick={onDismiss}
          >
            {t("common:actions.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundaryImpl extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled error in UI", error, info);
    this.setState({ componentStack: info.componentStack ?? undefined });
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.componentStack}
          onDismiss={() => this.setState({ error: null, componentStack: undefined })}
        />
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <ErrorBoundaryImpl>{children}</ErrorBoundaryImpl>;
}

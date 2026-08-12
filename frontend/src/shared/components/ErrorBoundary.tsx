import { Component, type ReactNode } from "react";
import { I18nContext, type I18nContextValue } from "@/shared/lib/i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  stack?: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  static contextType = I18nContext;
  declare context: I18nContextValue;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled error in UI", error, info);
    this.setState({ stack: info?.componentStack ?? undefined });
  }

  render() {
    if (this.state.error) {
      const { t } = this.context;
      return (
        <div className="min-h-screen bg-canvas text-foreground flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-xl bg-surface p-4 space-y-3 shadow-md">
            <div className="text-lg font-semibold">
              {t("common.errorBoundary.title")}
            </div>
            <div className="text-surface-muted-foreground text-sm break-words whitespace-pre-wrap">
              {this.state.error.message}
            </div>
            {this.state.error?.stack && (
              <div className="text-[0.6875rem] text-surface-muted-foreground whitespace-pre-wrap bg-surface-muted border rounded p-2 overflow-auto max-h-48">
                {this.state.error.stack}
              </div>
            )}
            {this.state.stack && (
              <div className="text-[0.6875rem] text-surface-muted-foreground whitespace-pre-wrap bg-surface-muted border rounded p-2 overflow-auto max-h-48">
                {this.state.stack}
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:bg-primary-hover"
                onClick={() => window.location.reload()}
              >
                {t("common.errorBoundary.reload")}
              </button>
              <button
                className="px-3 py-1.5 rounded-xl bg-surface text-surface-muted-foreground text-sm hover:bg-surface-muted hover:text-foreground"
                onClick={() => this.setState({ error: null })}
              >
                {t("common.errorBoundary.dismiss")}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

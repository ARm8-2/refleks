import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
  stack?: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled error in UI', error, info)
    this.setState({ stack: info?.componentStack ?? undefined })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface text-primary flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded border border-primary bg-surface-2 p-4 space-y-3 shadow-md">
            <div className="text-lg font-semibold">Something went wrong.</div>
            <div className="text-secondary text-sm break-words whitespace-pre-wrap">{this.state.error.message}</div>
            {this.state.error?.stack && (
              <div className="text-[11px] text-muted whitespace-pre-wrap bg-surface-3 border border-primary rounded p-2 overflow-auto max-h-48">
                {this.state.error.stack}
              </div>
            )}
            {this.state.stack && (
              <div className="text-[11px] text-muted whitespace-pre-wrap bg-surface-3 border border-primary rounded p-2 overflow-auto max-h-48">
                {this.state.stack}
              </div>
            )}
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 rounded bg-accent text-on-accent text-sm"
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
              <button
                className="px-3 py-1.5 rounded border border-primary text-sm hover:bg-surface-3"
                onClick={() => this.setState({ error: null })}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

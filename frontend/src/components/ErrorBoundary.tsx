import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] p-6">
          <div className="bg-surface border border-danger/30 rounded-xl p-6 max-w-lg text-center">
            <h3 className="text-danger font-semibold mb-2">Something went wrong</h3>
            <p className="text-text-secondary text-sm mb-3">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-sm rounded-lg bg-surface-2 text-text border border-border hover:bg-surface-2/80 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

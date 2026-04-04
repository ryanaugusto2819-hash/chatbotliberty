import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[220px] items-center justify-center p-8 text-center">
          <div className="max-w-xs">
            <div
              className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: '#dc2626' }} />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">
              Algo deu errado
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {this.state.error?.message || 'Erro inesperado. Tente novamente.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'rgba(124,58,237,0.08)',
                color: '#7c3aed',
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

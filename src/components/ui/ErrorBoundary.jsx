import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.handleReset,
        });
      }

      return (
        <div className="p-8 max-w-xl mx-auto my-8 bg-cream border border-danger/40 shadow-paper text-center">
          <div className="w-14 h-14 bg-danger/10 text-danger mx-auto flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold text-slate uppercase tracking-wider mb-2">
            Unable to Complete Analysis
          </h2>
          <p className="text-slate-muted font-body text-sm mb-4 leading-relaxed">
            An unexpected error occurred while rendering the analysis view. You can retry the step or go back to upload a different image.
          </p>
          {this.state.error && (
            <div className="mb-6 p-3 bg-danger/10 border border-danger/30 text-left rounded overflow-x-auto">
              <span className="font-mono text-xs font-bold text-danger uppercase block mb-1">
                Runtime Error Details:
              </span>
              <code className="font-mono text-xs text-danger break-words whitespace-pre-wrap block">
                {this.state.error.message || String(this.state.error)}
              </code>
            </div>
          )}
          <div className="flex justify-center gap-3">
            {this.props.onBack && (
              <button
                type="button"
                onClick={this.props.onBack}
                className="px-4 py-2 border border-cream-muted bg-cream-dark text-slate font-display text-xs uppercase tracking-wider hover:bg-cream transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
            )}
            <button
              type="button"
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-accent text-cream font-display text-xs uppercase tracking-wider font-bold hover:bg-accent-hover transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

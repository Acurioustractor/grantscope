'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  title?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ReportSection extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ReportSection] ${this.props.title || 'unknown'} crashed:`, error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border-2 border-bauhaus-red/20 bg-red-50 p-4 my-4">
          <p className="text-sm font-bold text-bauhaus-red uppercase tracking-wider">
            {this.props.title ? `${this.props.title} — ` : ''}Section unavailable
          </p>
          <p className="text-xs text-bauhaus-muted mt-1">
            This section encountered an error loading data. Other sections are unaffected.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="border-2 border-bauhaus-black/10 bg-gray-50 p-4 my-4">
      <p className="text-sm text-bauhaus-muted">
        {message || 'No data available for this section.'}
      </p>
    </div>
  );
}

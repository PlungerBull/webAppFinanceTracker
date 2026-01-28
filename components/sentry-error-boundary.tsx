'use client';

/**
 * Sentry Error Boundary
 *
 * Feature-level error boundary that reports crashes to Sentry
 * and renders a domain-specific fallback UI.
 *
 * CTO MANDATE: Feature-level boundaries, not a single global one.
 * A crash in "Currency Manager" should not white-screen the Dashboard.
 *
 * @module components/sentry-error-boundary
 */

import { Component } from 'react';
import * as Sentry from '@sentry/nextjs';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  /** Domain name for Sentry tagging (e.g., 'transactions', 'accounts') */
  domain: string;
  /** User-facing message shown in fallback UI */
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
}

export class SentryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Sentry.captureException(error, {
      tags: {
        domain: this.props.domain,
        errorType: 'render_crash',
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  render() {
    if (this.state.hasError) {
      const message =
        this.props.fallbackMessage ??
        'Something went wrong. Please try refreshing the page.';

      return (
        <div className="flex items-center justify-center p-8 text-center">
          <div className="max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="text-sm text-primary underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

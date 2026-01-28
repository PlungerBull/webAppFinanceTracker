'use client';

/**
 * Sentry Provider
 *
 * Initializes Sentry user context once authenticated.
 * Sets user ID only — no email, no username (PII mandate).
 *
 * @module providers/sentry-provider
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/stores/auth-store';
import type { ReactNode } from 'react';

interface SentryProviderProps {
  children: ReactNode;
}

export function SentryProvider({ children }: SentryProviderProps) {
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (userId) {
      Sentry.setUser({ id: userId });
    } else {
      Sentry.setUser(null);
    }
  }, [userId]);

  return <>{children}</>;
}

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createQueryOptions } from '@/lib/constants';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // S-TIER: Use STRUCTURAL volatility as safe fallback for any unconfigured queries
            // Individual hooks should use createQueryOptions() for explicit volatility
            ...createQueryOptions('STRUCTURAL'),
            retry: 3, // Explicit retry count for queries
          },
          mutations: {
            // Retry mutations on network errors with exponential backoff
            retry: (failureCount, error: Error) => {
              const message = error?.message ?? '';
              // Retry network errors up to 3 times
              if (message.includes('network') || message.includes('fetch')) {
                return failureCount < 3;
              }
              // Don't retry version conflicts or validation errors
              if (message === 'VERSION_CONFLICT_AFTER_RETRY' || message === 'VERSION_CONFLICT_DELETE') {
                return false;
              }
              // Retry other errors once
              return failureCount < 1;
            },
            // Exponential backoff: 1s, 2s, 4s, 8s, ... (max 30s)
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

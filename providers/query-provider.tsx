'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { QUERY_CONFIG } from '@/lib/constants';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Increase staleTime to reduce background refetches during optimistic updates
            // Higher staleTime prevents UI flicker between optimistic and server state
            staleTime: QUERY_CONFIG.STALE_TIME.LONG, // 10 minutes (was 1 minute)
            refetchOnWindowFocus: false,
            retry: 3, // Explicit retry count for queries
          },
          mutations: {
            // Retry mutations on network errors with exponential backoff
            retry: (failureCount, error: any) => {
              // Retry network errors up to 3 times
              if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
                return failureCount < 3;
              }
              // Don't retry version conflicts or validation errors
              if (error?.message === 'VERSION_CONFLICT_AFTER_RETRY' || error?.message === 'VERSION_CONFLICT_DELETE') {
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

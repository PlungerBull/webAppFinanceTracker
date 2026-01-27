'use client';

/**
 * Client-side Providers Wrapper
 *
 * Combines all client-side providers into a single component.
 * This allows the root layout (Server Component) to delegate
 * client-side provider setup to a Client Component.
 *
 * CTO MANDATE: SSR Isolation
 * LocalDbProvider must be dynamically imported with ssr: false
 * This is only possible in a Client Component.
 *
 * @module providers/client-providers
 */

import dynamic from 'next/dynamic';
import { QueryProvider } from '@/providers/query-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { SyncStatusProvider } from '@/providers/sync-status-provider';
import { CurrencyProvider } from '@/contexts/currency-context';
import { TransactionModalProvider } from '@/features/transactions/contexts/transaction-modal-context';
import { Toaster } from '@/components/ui/sonner';
import type { ReactNode } from 'react';

/**
 * LocalDbProvider with SSR disabled
 *
 * CTO MANDATE: WatermelonDB must not run on server.
 * Dynamic import with ssr: false ensures this.
 */
const LocalDbProvider = dynamic(
  () => import('@/providers/local-db-provider').then((mod) => mod.LocalDbProvider),
  { ssr: false }
);

interface ClientProvidersProps {
  children: ReactNode;
  modal: ReactNode;
}

/**
 * Client Providers Component
 *
 * Wraps children with all client-side providers in the correct order:
 * 1. QueryProvider - React Query for server state
 * 2. LocalDbProvider - WatermelonDB for local state (SSR disabled)
 * 3. CurrencyProvider - Currency context
 * 4. AuthProvider - Supabase auth
 * 5. SyncStatusProvider - Delta sync lifecycle & conflict toasts
 * 6. TransactionModalProvider - Modal state
 */
export function ClientProviders({ children, modal }: ClientProvidersProps) {
  return (
    <QueryProvider>
      <LocalDbProvider>
        <CurrencyProvider>
          <AuthProvider>
            <SyncStatusProvider>
              <TransactionModalProvider>
                {children}
                {modal}
                <Toaster />
              </TransactionModalProvider>
            </SyncStatusProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LocalDbProvider>
    </QueryProvider>
  );
}

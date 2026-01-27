/**
 * Transaction Service Hook
 *
 * Provides configured transaction service instance with proper dependency injection.
 *
 * Phase 2c: Hybrid Repository
 * - Uses HybridTransactionRepository for offline-first architecture
 * - Graceful degradation when WatermelonDB unavailable
 *
 * This hook creates service instances with:
 * - Repository (Hybrid: Local + Remote)
 * - Auth provider (Supabase implementation)
 *
 * @module use-transaction-service
 */

'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createHybridTransactionRepository } from '../repository';
import { createTransactionService, type ITransactionService } from '../services';
import { useLocalDatabase } from '@/lib/local-db';

/**
 * Hook to get transaction service instance
 *
 * Creates service with proper dependency injection:
 * 1. Gets WatermelonDB database from context
 * 2. Creates Supabase client
 * 3. Creates hybrid repository (local + remote)
 * 4. Creates auth provider with Supabase client
 * 5. Creates service with repository + auth provider
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Waits for local database to be ready
 * - Graceful Degradation: Falls back to Supabase-only if WatermelonDB unavailable
 *
 * Uses useMemo to avoid recreating on every render.
 * Recreates when local database state changes.
 *
 * @returns Transaction service instance or null if not ready
 *
 * @example
 * ```typescript
 * export function useTransactions(filters?: TransactionFilters) {
 *   const service = useTransactionService();
 *
 *   return useInfiniteQuery({
 *     queryKey: ['transactions', 'infinite', filters],
 *     queryFn: ({ pageParam = 0 }) =>
 *       service.getAllPaginated(filters, {
 *         offset: pageParam,
 *         limit: PAGINATION.DEFAULT_PAGE_SIZE,
 *       }),
 *     enabled: !!service, // Don't run until service is ready
 *     // ... rest of config
 *   });
 * }
 * ```
 */
export function useTransactionService(): ITransactionService | null {
  const { database, isReady } = useLocalDatabase();

  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create service until local database state is known
    if (!isReady) {
      return null;
    }

    const supabase = createClient();
    // CTO MANDATE: Hybrid Repository with graceful degradation
    const repository = createHybridTransactionRepository(supabase, database);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createTransactionService(repository, authProvider);
  }, [database, isReady]);
}

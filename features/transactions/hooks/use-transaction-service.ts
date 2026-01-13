/**
 * Transaction Service Hook
 *
 * Provides configured transaction service instance with proper dependency injection.
 *
 * This hook creates service instances with:
 * - Repository (Supabase implementation)
 * - Auth provider (Supabase implementation)
 *
 * @module use-transaction-service
 */

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createTransactionRepository } from '../repository';
import { createTransactionService, type ITransactionService } from '../services';

/**
 * Hook to get transaction service instance
 *
 * Creates service with proper dependency injection:
 * 1. Creates Supabase client
 * 2. Creates repository with client
 * 3. Creates auth provider with client
 * 4. Creates service with repository + auth provider
 *
 * Uses useMemo to avoid recreating on every render.
 *
 * @returns Transaction service instance
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
 *     // ... rest of config
 *   });
 * }
 * ```
 */
export function useTransactionService(): ITransactionService {
  return useMemo(() => {
    const supabase = createClient();
    const repository = createTransactionRepository(supabase);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createTransactionService(repository, authProvider);
  }, []);
}

/**
 * Account Service Hook
 *
 * Dependency injection hook for account service.
 * Memoizes service instance for React component lifecycle.
 *
 * @module use-account-service
 */

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createAccountRepository } from '../repository';
import { createAccountService, type IAccountService } from '../services';

/**
 * Use Account Service
 *
 * Creates and memoizes an account service instance.
 * Uses dependency injection pattern for testability.
 *
 * @returns Account service instance
 *
 * @example
 * ```typescript
 * function AccountList() {
 *   const service = useAccountService();
 *
 *   useEffect(() => {
 *     service.getAll().then(setAccounts);
 *   }, []);
 * }
 * ```
 */
export function useAccountService(): IAccountService {
  return useMemo(() => {
    const supabase = createClient();
    const repository = createAccountRepository(supabase);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createAccountService(repository, authProvider);
  }, []);
}

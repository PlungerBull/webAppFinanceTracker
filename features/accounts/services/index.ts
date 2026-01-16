/**
 * Account Service Exports
 *
 * Factory function and interface exports for account service.
 *
 * @module account-service
 */

import type { IAuthProvider } from '@/lib/auth/auth-provider.interface';
import type { IAccountRepository } from '../repository/account-repository.interface';
import { AccountService } from './account-service';
import type { IAccountService } from './account-service.interface';

// Export interface
export type { IAccountService } from './account-service.interface';

/**
 * Create Account Service
 *
 * Factory function for creating an account service instance.
 *
 * @param repository - Account repository instance
 * @param authProvider - Auth provider instance
 * @returns IAccountService implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { createSupabaseAuthProvider } from '@/lib/auth';
 * import { createAccountRepository } from '@/features/accounts/repository';
 * import { createAccountService } from '@/features/accounts/services';
 *
 * const supabase = createClient();
 * const repository = createAccountRepository(supabase);
 * const authProvider = createSupabaseAuthProvider(supabase);
 * const service = createAccountService(repository, authProvider);
 *
 * const accounts = await service.getAll();
 * ```
 */
export function createAccountService(
  repository: IAccountRepository,
  authProvider: IAuthProvider
): IAccountService {
  return new AccountService(repository, authProvider);
}

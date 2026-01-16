/**
 * Account Repository Exports
 *
 * Factory function and interface exports for account repository.
 *
 * @module account-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { SupabaseAccountRepository } from './supabase-account-repository';
import type { IAccountRepository } from './account-repository.interface';

// Export interface
export type { IAccountRepository } from './account-repository.interface';

/**
 * Create Account Repository
 *
 * Factory function for creating an account repository instance.
 *
 * @param supabase - Supabase client instance
 * @returns IAccountRepository implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { createAccountRepository } from '@/features/accounts/repository';
 *
 * const supabase = createClient();
 * const repository = createAccountRepository(supabase);
 * const result = await repository.getAll(userId);
 * ```
 */
export function createAccountRepository(
  supabase: SupabaseClient<Database>
): IAccountRepository {
  return new SupabaseAccountRepository(supabase);
}

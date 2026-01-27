/**
 * Account Repository Exports
 *
 * Factory functions and interface exports for account repository.
 *
 * CTO MANDATES:
 * - Hybrid Repository: Local-first with graceful degradation
 * - createHybridAccountRepository for offline-first architecture
 * - createAccountRepository (legacy) for Supabase-only mode
 *
 * @module account-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type { Database as WatermelonDatabase } from '@nozbe/watermelondb';
import { SupabaseAccountRepository } from './supabase-account-repository';
import { LocalAccountRepository } from './local-account-repository';
import { HybridAccountRepository } from './hybrid-account-repository';
import type { IAccountRepository } from './account-repository.interface';

// Export interface
export type { IAccountRepository } from './account-repository.interface';

// Export repository classes for direct use
export { LocalAccountRepository } from './local-account-repository';
export { HybridAccountRepository } from './hybrid-account-repository';

/**
 * Create Hybrid Account Repository
 *
 * Factory function for creating an offline-first account repository.
 * Uses WatermelonDB for local storage with Supabase sync capability.
 *
 * CTO MANDATE: Graceful Degradation
 * - If WatermelonDB is available: Returns HybridAccountRepository
 * - If WatermelonDB is unavailable: Returns SupabaseAccountRepository (fallback)
 *
 * @param supabase - Supabase client instance
 * @param watermelonDb - WatermelonDB database instance (null if unavailable)
 * @returns IAccountRepository implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { useLocalDatabase } from '@/lib/local-db';
 * import { createHybridAccountRepository } from '@/features/accounts/repository';
 *
 * const supabase = createClient();
 * const { database } = useLocalDatabase();
 * const repository = createHybridAccountRepository(supabase, database);
 * ```
 */
export function createHybridAccountRepository(
  supabase: SupabaseClient<SupabaseDatabase>,
  watermelonDb: WatermelonDatabase | null
): IAccountRepository {
  const remoteRepository = new SupabaseAccountRepository(supabase);

  // CTO MANDATE: Graceful Degradation
  if (!watermelonDb) {
    console.log('[AccountRepository] WatermelonDB unavailable, using Supabase-only mode');
    return remoteRepository;
  }

  const localRepository = new LocalAccountRepository(watermelonDb);
  return new HybridAccountRepository(localRepository, remoteRepository);
}

/**
 * Create Account Repository (Legacy)
 *
 * Factory function for creating a Supabase-only account repository.
 * Use createHybridAccountRepository for offline-first architecture.
 *
 * @param supabase - Supabase client instance
 * @returns IAccountRepository implementation
 *
 * @deprecated Use createHybridAccountRepository for offline-first architecture
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
  supabase: SupabaseClient<SupabaseDatabase>
): IAccountRepository {
  return new SupabaseAccountRepository(supabase);
}

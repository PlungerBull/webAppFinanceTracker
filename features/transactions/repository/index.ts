/**
 * Transaction Repository Exports
 *
 * Factory functions for creating repository instances with dependency injection.
 *
 * CTO Mandate #5: Real Dependency Injection (NOT Singletons)
 * - Factory receives SupabaseClient as parameter
 * - Enables testing with mock clients
 * - No hidden global state
 *
 * Phase 2c: Hybrid Repository
 * - createHybridTransactionRepository for offline-first architecture
 * - Graceful degradation when WatermelonDB unavailable
 *
 * @module transaction-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type { Database as WatermelonDatabase } from '@nozbe/watermelondb';
import { SupabaseTransactionRepository } from './supabase-transaction-repository';
import { SupabaseTransferRepository } from './supabase-transfer-repository';
import { LocalTransactionRepository } from './local-transaction-repository';
import { HybridTransactionRepository } from './hybrid-transaction-repository';
import type { ITransactionRepository } from './transaction-repository.interface';
import type { ITransferRepository } from './transfer-repository.interface';

// Re-export interfaces
export type { ITransactionRepository } from './transaction-repository.interface';
export type { ITransferRepository, TransferCreationResult } from './transfer-repository.interface';

// Re-export repository classes for direct access
export { LocalTransactionRepository } from './local-transaction-repository';
export { HybridTransactionRepository } from './hybrid-transaction-repository';
export { SupabaseTransactionRepository } from './supabase-transaction-repository';

/**
 * Creates a new transaction repository instance (Supabase only)
 *
 * Factory pattern with dependency injection.
 * Service layer (or tests) provides the Supabase client.
 *
 * NOTE: For offline-first architecture, use createHybridTransactionRepository instead.
 *
 * @param supabase - Supabase client instance
 * @returns Repository implementation
 *
 * @example
 * ```typescript
 * // Production usage (online-only)
 * const supabase = createClient();
 * const repository = createTransactionRepository(supabase);
 *
 * // Testing usage
 * const mockSupabase = createMockClient();
 * const repository = createTransactionRepository(mockSupabase);
 * ```
 */
export function createTransactionRepository(
  supabase: SupabaseClient<SupabaseDatabase>
): ITransactionRepository {
  return new SupabaseTransactionRepository(supabase);
}

/**
 * Creates a new hybrid transaction repository instance
 *
 * CTO MANDATE: Offline-First Architecture
 * - All reads go to WatermelonDB (local-first)
 * - All writes go to WatermelonDB with 'pending' status
 * - Sync engine (Phase 2d) pushes to Supabase
 *
 * Graceful Degradation:
 * - If WatermelonDB is null (SSR or unavailable), falls back to Supabase-only
 *
 * @param supabase - Supabase client instance
 * @param watermelonDb - WatermelonDB instance (null if unavailable)
 * @returns Repository implementation (Hybrid or Supabase-only)
 *
 * @example
 * ```typescript
 * // In useTransactionService hook:
 * const { database: watermelonDb, isReady } = useLocalDatabase();
 *
 * const repository = useMemo(() => {
 *   if (!isReady) return null; // Still loading
 *   const supabase = createClient();
 *   return createHybridTransactionRepository(supabase, watermelonDb);
 * }, [watermelonDb, isReady]);
 * ```
 */
export function createHybridTransactionRepository(
  supabase: SupabaseClient<SupabaseDatabase>,
  watermelonDb: WatermelonDatabase | null
): ITransactionRepository {
  const remoteRepository = new SupabaseTransactionRepository(supabase);

  // CTO MANDATE: Graceful Degradation
  // If WatermelonDB unavailable, fall back to Supabase-only
  if (!watermelonDb) {
    console.log('[Repository] WatermelonDB unavailable, using Supabase-only mode');
    return remoteRepository;
  }

  const localRepository = new LocalTransactionRepository(watermelonDb);
  return new HybridTransactionRepository(localRepository, remoteRepository);
}

/**
 * Creates a new transfer repository instance
 *
 * Factory pattern with dependency injection.
 * Service layer (or tests) provides the Supabase client.
 *
 * @param supabase - Supabase client instance
 * @returns Repository implementation
 */
export function createTransferRepository(
  supabase: SupabaseClient<SupabaseDatabase>
): ITransferRepository {
  return new SupabaseTransferRepository(supabase);
}

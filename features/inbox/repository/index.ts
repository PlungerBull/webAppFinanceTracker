/**
 * Inbox Repository Exports
 *
 * Factory functions and interface exports for inbox repository.
 *
 * CTO MANDATES:
 * - Hybrid Repository: Local-first with graceful degradation
 * - createHybridInboxRepository for offline-first architecture
 *
 * @module inbox-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type { Database as WatermelonDatabase } from '@nozbe/watermelondb';
import { SupabaseInboxRepository } from './supabase-inbox-repository';
import { LocalInboxRepository } from './local-inbox-repository';
import { HybridInboxRepository } from './hybrid-inbox-repository';
import type { IInboxRepository } from './inbox-repository.interface';

// Interface
export type { IInboxRepository } from './inbox-repository.interface';

// Repository classes for direct use
export { LocalInboxRepository } from './local-inbox-repository';
export { HybridInboxRepository } from './hybrid-inbox-repository';
export { SupabaseInboxRepository } from './supabase-inbox-repository';

/**
 * Create Hybrid Inbox Repository
 *
 * Factory function for creating an offline-first inbox repository.
 * Uses WatermelonDB for local storage with Supabase sync capability.
 *
 * CTO MANDATE: Graceful Degradation
 * - If WatermelonDB is available: Returns HybridInboxRepository
 * - If WatermelonDB is unavailable: Returns SupabaseInboxRepository (fallback)
 *
 * @param supabase - Supabase client instance
 * @param watermelonDb - WatermelonDB database instance (null if unavailable)
 * @returns IInboxRepository implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { useLocalDatabase } from '@/lib/local-db';
 * import { createHybridInboxRepository } from '@/features/inbox/repository';
 *
 * const supabase = createClient();
 * const { database } = useLocalDatabase();
 * const repository = createHybridInboxRepository(supabase, database);
 * ```
 */
export function createHybridInboxRepository(
  supabase: SupabaseClient<SupabaseDatabase>,
  watermelonDb: WatermelonDatabase | null
): IInboxRepository {
  const remoteRepository = new SupabaseInboxRepository(supabase);

  // CTO MANDATE: Graceful Degradation
  if (!watermelonDb) {
    console.log('[InboxRepository] WatermelonDB unavailable, using Supabase-only mode');
    return remoteRepository;
  }

  const localRepository = new LocalInboxRepository(watermelonDb);
  return new HybridInboxRepository(localRepository, remoteRepository);
}

/**
 * Create Inbox Repository (Legacy)
 *
 * Factory function for creating a Supabase-only inbox repository.
 * Use createHybridInboxRepository for offline-first architecture.
 *
 * @param supabase - Supabase client instance
 * @returns IInboxRepository implementation
 *
 * @deprecated Use createHybridInboxRepository for offline-first architecture
 */
export function createInboxRepository(
  supabase: SupabaseClient<SupabaseDatabase>
): IInboxRepository {
  return new SupabaseInboxRepository(supabase);
}

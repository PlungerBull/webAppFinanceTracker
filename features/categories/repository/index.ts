/**
 * Category Repository Exports
 *
 * Factory functions and interface exports for category repository.
 *
 * CTO MANDATES:
 * - Hybrid Repository: Local-first with graceful degradation
 * - createHybridCategoryRepository for offline-first architecture
 * - createCategoryRepository (legacy) for Supabase-only mode
 *
 * @module category-repository
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database as SupabaseDatabase } from '@/types/supabase';
import type { Database as WatermelonDatabase } from '@nozbe/watermelondb';
import { SupabaseCategoryRepository } from './supabase-category-repository';
import { LocalCategoryRepository } from './local-category-repository';
import { HybridCategoryRepository } from './hybrid-category-repository';
import type { ICategoryRepository } from './category-repository.interface';

// Interface
export type { ICategoryRepository } from './category-repository.interface';
export type { MergeCategoriesResult } from './category-repository.interface';

// Repository classes for direct use
export { LocalCategoryRepository } from './local-category-repository';
export { HybridCategoryRepository } from './hybrid-category-repository';
export { SupabaseCategoryRepository } from './supabase-category-repository';

/**
 * Create Hybrid Category Repository
 *
 * Factory function for creating an offline-first category repository.
 * Uses WatermelonDB for local storage with Supabase sync capability.
 *
 * CTO MANDATE: Graceful Degradation
 * - If WatermelonDB is available: Returns HybridCategoryRepository
 * - If WatermelonDB is unavailable: Returns SupabaseCategoryRepository (fallback)
 *
 * @param supabase - Supabase client instance
 * @param watermelonDb - WatermelonDB database instance (null if unavailable)
 * @returns ICategoryRepository implementation
 *
 * @example
 * ```typescript
 * import { createClient } from '@/lib/supabase/client';
 * import { useLocalDatabase } from '@/lib/local-db';
 * import { createHybridCategoryRepository } from '@/features/categories/repository';
 *
 * const supabase = createClient();
 * const { database } = useLocalDatabase();
 * const repository = createHybridCategoryRepository(supabase, database);
 * ```
 */
export function createHybridCategoryRepository(
  supabase: SupabaseClient<SupabaseDatabase>,
  watermelonDb: WatermelonDatabase | null
): ICategoryRepository {
  const remoteRepository = new SupabaseCategoryRepository(supabase);

  // CTO MANDATE: Graceful Degradation
  if (!watermelonDb) {
    console.log('[CategoryRepository] WatermelonDB unavailable, using Supabase-only mode');
    return remoteRepository;
  }

  const localRepository = new LocalCategoryRepository(watermelonDb);
  return new HybridCategoryRepository(localRepository, remoteRepository);
}

/**
 * Create Category Repository (Legacy)
 *
 * Factory function for creating a Supabase-only category repository.
 * Use createHybridCategoryRepository for offline-first architecture.
 *
 * @param supabase - Supabase client instance
 * @returns ICategoryRepository implementation
 *
 * @deprecated Use createHybridCategoryRepository for offline-first architecture
 */
export function createCategoryRepository(
  supabase: SupabaseClient<SupabaseDatabase>
): ICategoryRepository {
  return new SupabaseCategoryRepository(supabase);
}

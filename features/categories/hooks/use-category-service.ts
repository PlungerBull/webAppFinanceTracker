/**
 * Category Service Hook
 *
 * Provides configured category service instance with proper dependency injection.
 *
 * Phase 2c: Hybrid Repository
 * - Uses HybridCategoryRepository for offline-first architecture
 * - Graceful degradation when WatermelonDB unavailable
 *
 * This hook creates service instances with:
 * - Repository (Hybrid: Local + Remote)
 * - Auth provider (Supabase implementation)
 *
 * @module use-category-service
 */

'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createHybridCategoryRepository } from '../repository';
import { createCategoryService, type ICategoryService } from '../services';
import { useLocalDatabase } from '@/lib/local-db';

/**
 * Hook to get category service instance
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
 * @returns Category service instance or null if not ready
 *
 * @example
 * ```typescript
 * export function useCategories() {
 *   const service = useCategoryService();
 *
 *   return useQuery({
 *     queryKey: ['categories'],
 *     queryFn: () => service.getAll(),
 *     enabled: !!service, // Don't run until service is ready
 *   });
 * }
 * ```
 */
export function useCategoryService(): ICategoryService | null {
  const { database, isReady } = useLocalDatabase();

  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create service until local database state is known
    if (!isReady) {
      return null;
    }

    const supabase = createClient();
    // CTO MANDATE: Hybrid Repository with graceful degradation
    const repository = createHybridCategoryRepository(supabase, database);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createCategoryService(repository, authProvider);
  }, [database, isReady]);
}

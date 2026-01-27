/**
 * Inbox Service Hook
 *
 * Provides configured inbox service instance with proper dependency injection.
 *
 * Phase 2c: Hybrid Repository
 * - Uses HybridInboxRepository for offline-first architecture
 * - Graceful degradation when WatermelonDB unavailable
 *
 * This hook creates service instances with:
 * - Repository (Hybrid: Local + Remote)
 * - Auth provider (Supabase implementation)
 *
 * @module use-inbox-service
 */

'use client';

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createSupabaseAuthProvider } from '@/lib/auth/supabase-auth-provider';
import { createHybridInboxRepository } from '../repository';
import { createInboxService, type IInboxService } from '../services/inbox-service';
import { useLocalDatabase } from '@/lib/local-db';

/**
 * Hook to get inbox service instance
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
 * @returns Inbox service instance or null if not ready
 *
 * @example
 * ```typescript
 * export function useInboxItems() {
 *   const service = useInboxService();
 *
 *   return useQuery({
 *     queryKey: ['inbox', 'pending'],
 *     queryFn: () => service.getPendingPaginated(),
 *     enabled: !!service, // Don't run until service is ready
 *   });
 * }
 * ```
 */
export function useInboxService(): IInboxService | null {
  const { database, isReady } = useLocalDatabase();

  return useMemo(() => {
    // CTO MANDATE: Orchestrator Rule
    // Don't create service until local database state is known
    if (!isReady) {
      return null;
    }

    const supabase = createClient();
    // CTO MANDATE: Hybrid Repository with graceful degradation
    const repository = createHybridInboxRepository(supabase, database);
    const authProvider = createSupabaseAuthProvider(supabase);
    return createInboxService(repository, authProvider);
  }, [database, isReady]);
}

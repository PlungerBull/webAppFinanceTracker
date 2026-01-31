/**
 * useLocalDatabase Hook
 *
 * Provides access to the WatermelonDB database instance with hydration safety.
 *
 * CTO MANDATES:
 * - Hydration Guard: Uses isMounted state to prevent SSR hydration mismatches
 * - Graceful Degradation: Returns null if database unavailable
 * - Orchestrator Rule: isReady must be true before any repository calls
 *
 * @module local-db/hooks/use-local-database
 */

'use client';

import { useState, useEffect } from 'react';
import type { Database } from '@nozbe/watermelondb';
import { getLocalDatabase } from '../database';

/**
 * Local database state
 */
interface LocalDatabaseState {
  /** WatermelonDB database instance (null if not ready or unavailable) */
  database: Database | null;
  /** True when database is ready for use (even if null due to degradation) */
  isReady: boolean;
  /** True while database is initializing */
  isLoading: boolean;
  /** Error from initialization (null if successful or loading) */
  error: Error | null;
}

/**
 * useLocalDatabase Hook
 *
 * Provides access to WatermelonDB with proper SSR/hydration handling.
 *
 * CTO MANDATE: Hydration Guard
 * Uses isMounted pattern to prevent React hydration mismatches.
 * Server renders with isReady=false, client hydrates then loads database.
 *
 * @returns LocalDatabaseState with database instance and loading state
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { database, isReady, isLoading, error } = useLocalDatabase();
 *
 *   // CTO MANDATE: Orchestrator Rule - guard ALL database access
 *   if (!isReady) {
 *     return <Loading />;
 *   }
 *
 *   // Database may still be null (graceful degradation)
 *   // Repository handles this by falling back to remote-only
 *   return <TransactionList />;
 * }
 * ```
 */
export function useLocalDatabase(): LocalDatabaseState {
  // CTO MANDATE: Hydration Guard - start with mounted=false
  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<LocalDatabaseState>({
    database: null,
    isReady: false,
    isLoading: true,
    error: null,
  });

  // Mark as mounted after hydration
  /* eslint-disable react-hooks/set-state-in-effect -- SSR hydration guard is external system sync */
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize database after mount (prevents SSR hydration mismatch)
  useEffect(() => {
    if (!isMounted) {
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const db = await getLocalDatabase();

        if (cancelled) return;

        setState({
          database: db,
          isReady: true,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;

        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[useLocalDatabase] Initialization failed:', error);

        setState({
          database: null,
          isReady: true, // Ready to proceed in degraded mode
          isLoading: false,
          error,
        });
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [isMounted]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return state;
}

/**
 * Convenience hook for just the database instance
 *
 * Use when you don't need loading/error state.
 * Returns null until database is ready.
 *
 * @returns Database instance or null
 */
export function useLocalDatabaseInstance(): Database | null {
  const { database, isReady } = useLocalDatabase();
  return isReady ? database : null;
}

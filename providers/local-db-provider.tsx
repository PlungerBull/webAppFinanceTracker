'use client';

/**
 * Local Database Provider
 *
 * Provides WatermelonDB database context to the application.
 * Handles async initialization and graceful degradation.
 *
 * CTO MANDATES:
 * - SSR Isolation: This provider must be dynamically imported with { ssr: false }
 * - Graceful Degradation: If IndexedDB unavailable, app works in online-only mode
 * - Observer Trap: Keep React Query as primary state management
 *
 * Usage in app/layout.tsx:
 * ```tsx
 * const LocalDbProvider = dynamic(
 *   () => import('@/providers/local-db-provider').then(mod => mod.LocalDbProvider),
 *   { ssr: false }
 * );
 * ```
 *
 * @module providers/local-db-provider
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database } from '@nozbe/watermelondb';

/**
 * Local Database Context Value
 */
interface LocalDbContextValue {
  /** WatermelonDB database instance (null if not ready or unavailable) */
  database: Database | null;
  /** Whether the database is ready for use */
  isReady: boolean;
  /** Whether the database is currently initializing */
  isInitializing: boolean;
  /** Error from database initialization (null if successful) */
  error: Error | null;
  /** Whether offline mode is available (database initialized successfully) */
  isOfflineAvailable: boolean;
}

/**
 * Default context value (before initialization)
 */
const defaultContextValue: LocalDbContextValue = {
  database: null,
  isReady: false,
  isInitializing: true,
  error: null,
  isOfflineAvailable: false,
};

/**
 * Local Database Context
 */
const LocalDbContext = createContext<LocalDbContextValue>(defaultContextValue);

/**
 * Local Database Provider Props
 */
interface LocalDbProviderProps {
  children: ReactNode;
}

/**
 * Local Database Provider Component
 *
 * Initializes WatermelonDB on mount and provides database context.
 * Handles errors gracefully - app continues to work in online-only mode.
 *
 * CTO WARNING: Do not use this provider directly in layout.tsx.
 * Always use dynamic import with { ssr: false }.
 */
export function LocalDbProvider({ children }: LocalDbProviderProps) {
  const [state, setState] = useState<LocalDbContextValue>(defaultContextValue);

  useEffect(() => {
    let mounted = true;

    async function initDatabase() {
      try {
        // Dynamic import to prevent SSR issues
        const { getLocalDatabase, getLocalDatabaseError } = await import('@/lib/local-db');

        const database = await getLocalDatabase();
        const error = getLocalDatabaseError();

        if (!mounted) return;

        if (database) {
          setState({
            database,
            isReady: true,
            isInitializing: false,
            error: null,
            isOfflineAvailable: true,
          });
          console.log('[LocalDbProvider] Database ready');
        } else {
          setState({
            database: null,
            isReady: true, // Ready to proceed (in online-only mode)
            isInitializing: false,
            error: error,
            isOfflineAvailable: false,
          });
          if (error) {
            console.warn('[LocalDbProvider] Database unavailable:', error.message);
          } else {
            console.log('[LocalDbProvider] Running in online-only mode');
          }
        }
      } catch (error) {
        if (!mounted) return;

        const err = error instanceof Error ? error : new Error(String(error));
        setState({
          database: null,
          isReady: true, // Ready to proceed (in online-only mode)
          isInitializing: false,
          error: err,
          isOfflineAvailable: false,
        });
        console.error('[LocalDbProvider] Initialization error:', err);
      }
    }

    initDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <LocalDbContext.Provider value={state}>
      {children}
    </LocalDbContext.Provider>
  );
}

/**
 * Hook to access the local database context
 *
 * CTO MANDATES:
 *
 * 1. Observer Trap Prevention:
 *    - Use this hook for accessing the database instance only
 *    - DO NOT use WatermelonDB observables for standard CRUD
 *    - Use React Query for data fetching and mutations
 *
 * 2. Orchestrator Rule (SSR & Hydration Kill-Switch):
 *    - NO repository call is permitted unless `isReady === true`
 *    - Treat the local database as an asynchronous dependency
 *    - Never assume database is available during initial render
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { database, isReady, isOfflineAvailable } = useLocalDb();
 *
 *   // CTO MANDATE: Orchestrator Rule - guard ALL database access
 *   if (!isReady) {
 *     return <Loading />;
 *   }
 *
 *   // Safe to use database here (may still be null if offline unavailable)
 *   // Use React Query for data, not WatermelonDB observables
 *   const { data } = useTransactions();
 *
 *   return <TransactionList data={data} />;
 * }
 * ```
 */
export function useLocalDb(): LocalDbContextValue {
  const context = useContext(LocalDbContext);

  if (context === undefined) {
    throw new Error('useLocalDb must be used within a LocalDbProvider');
  }

  return context;
}

/**
 * Hook to check if offline mode is available
 *
 * Convenience hook for components that need to show
 * offline/online status indicators.
 */
export function useOfflineAvailable(): boolean {
  const { isOfflineAvailable } = useLocalDb();
  return isOfflineAvailable;
}

/**
 * useInitialHydration Hook
 *
 * React hook for managing initial data hydration from Supabase to WatermelonDB.
 *
 * CTO MANDATES:
 * - Orchestrator Rule: Service may be null, hook must guard
 * - SSR Safety: No hydration attempts during SSR
 * - One-shot: Hydration runs once per device/user
 *
 * @module sync/hooks/use-initial-hydration
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLocalDatabase } from '@/lib/local-db';
import {
  createInitialHydrationService,
  type HydrationResult,
  type HydrationStatus,
} from '../initial-hydration-service';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Hydration hook state
 */
interface HydrationState {
  /** Whether hydration check is in progress */
  isChecking: boolean;
  /** Whether hydration is in progress */
  isHydrating: boolean;
  /** Whether hydration is complete (not needed or finished) */
  isComplete: boolean;
  /** Hydration status */
  status: HydrationStatus | null;
  /** Hydration result (after completion) */
  result: HydrationResult | null;
  /** Error from hydration (if failed) */
  error: Error | null;
}

/**
 * Hydration hook return value
 */
interface UseInitialHydrationReturn extends HydrationState {
  /** Manually trigger hydration (for retry scenarios) */
  triggerHydration: () => Promise<void>;
  /** Force re-hydration (clears local data) */
  forceRehydrate: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useInitialHydration Hook
 *
 * Automatically checks if hydration is needed on mount and performs it.
 * Use this hook at the app root level to ensure data is available before
 * rendering data-dependent components.
 *
 * @param userId - Current user's ID (from auth)
 * @returns Hydration state and control functions
 *
 * @example
 * ```typescript
 * function AppProvider({ children }: { children: React.ReactNode }) {
 *   const { user } = useAuth();
 *   const { isComplete, isHydrating, error, status } = useInitialHydration(user?.id);
 *
 *   // Show loading while hydrating
 *   if (!isComplete) {
 *     return <HydrationLoadingScreen isHydrating={isHydrating} />;
 *   }
 *
 *   // Show error if hydration failed
 *   if (error && status === 'failed') {
 *     return <HydrationErrorScreen error={error} />;
 *   }
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useInitialHydration(userId: string | undefined): UseInitialHydrationReturn {
  const { database, isReady: isDatabaseReady } = useLocalDatabase();
  const [state, setState] = useState<HydrationState>({
    isChecking: true,
    isHydrating: false,
    isComplete: false,
    status: null,
    result: null,
    error: null,
  });

  // Track if we've already hydrated this session
  const hasHydratedRef = useRef(false);

  /**
   * Perform hydration
   */
  const performHydration = useCallback(async (forceRehydrate = false) => {
    // Guard: Need database and userId
    if (!database || !userId) {
      console.log('[useInitialHydration] Skipping - database or userId not ready');
      setState((prev) => ({
        ...prev,
        isChecking: false,
        isComplete: true,
        status: 'skipped',
      }));
      return;
    }

    try {
      const supabase = createClient();
      const service = createInitialHydrationService(database, supabase);

      // Check if hydration is needed (unless forcing)
      if (!forceRehydrate) {
        setState((prev) => ({ ...prev, isChecking: true }));
        const needsHydration = await service.isHydrationNeeded();

        if (!needsHydration) {
          console.log('[useInitialHydration] Hydration not needed');
          setState({
            isChecking: false,
            isHydrating: false,
            isComplete: true,
            status: 'not_needed',
            result: null,
            error: null,
          });
          return;
        }
      }

      // Perform hydration
      console.log('[useInitialHydration] Starting hydration...');
      setState((prev) => ({
        ...prev,
        isChecking: false,
        isHydrating: true,
        error: null,
      }));

      const result = forceRehydrate
        ? await service.forceRehydrate(userId)
        : await service.hydrate(userId);

      console.log('[useInitialHydration] Hydration complete:', result.status);
      setState({
        isChecking: false,
        isHydrating: false,
        isComplete: true,
        status: result.status,
        result,
        error: result.status === 'failed' ? new Error('Hydration failed') : null,
      });

      hasHydratedRef.current = true;
    } catch (error) {
      console.error('[useInitialHydration] Hydration error:', error);
      setState({
        isChecking: false,
        isHydrating: false,
        isComplete: true,
        status: 'failed',
        result: null,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [database, userId]);

  /**
   * Trigger hydration manually (for retry)
   */
  const triggerHydration = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isChecking: true,
      isComplete: false,
      error: null,
    }));
    await performHydration(false);
  }, [performHydration]);

  /**
   * Force re-hydration (clears local data)
   */
  const forceRehydrate = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isChecking: false,
      isHydrating: true,
      isComplete: false,
      error: null,
    }));
    await performHydration(true);
  }, [performHydration]);

  // Auto-hydrate on mount when dependencies are ready
  useEffect(() => {
    // Wait for database to be ready
    if (!isDatabaseReady) {
      return;
    }

    // Skip if no userId (user not logged in)
    if (!userId) {
      setState({
        isChecking: false,
        isHydrating: false,
        isComplete: true,
        status: 'skipped',
        result: null,
        error: null,
      });
      return;
    }

    // Skip if no database (graceful degradation to online-only)
    if (!database) {
      console.log('[useInitialHydration] No database available, skipping hydration');
      setState({
        isChecking: false,
        isHydrating: false,
        isComplete: true,
        status: 'skipped',
        result: null,
        error: null,
      });
      return;
    }

    // Skip if already hydrated this session
    if (hasHydratedRef.current) {
      return;
    }

    // Perform hydration check and possibly hydrate
    performHydration(false);
  }, [isDatabaseReady, database, userId, performHydration]);

  return {
    ...state,
    triggerHydration,
    forceRehydrate,
  };
}

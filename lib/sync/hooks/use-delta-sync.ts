/**
 * useDeltaSync Hook
 *
 * React hook for background synchronization.
 *
 * CTO MANDATE: Sync MUST NEVER block UI.
 * - Runs in background on interval (default 30s)
 * - Triggers on: app focus, network reconnect
 * - Uses requestIdleCallback to avoid UI jank
 * - Exposes: isSyncing, lastSyncedAt, syncErrors, forceSync()
 *
 * @module sync/hooks/use-delta-sync
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLocalDatabase } from '@/lib/local-db';
import {
  createDeltaSyncEngine,
  type IDeltaSyncEngine,
} from '../delta-sync-engine';
import type {
  SyncConfig,
  SyncCycleResult,
  SyncEngineStatus,
  ConflictRecord,
} from '../types';
import {
  DEFAULT_SYNC_CONFIG,
  IDLE_CALLBACK_TIMEOUT_MS,
  MIN_SYNC_INTERVAL_MS,
} from '../constants';

// ============================================================================
// TYPES
// ============================================================================

export interface UseDeltaSyncOptions {
  /** User ID for sync operations */
  userId: string | undefined;
  /** Whether sync is enabled (default: true) */
  enabled?: boolean;
  /** Custom sync configuration */
  config?: Partial<SyncConfig>;
  /** Callback when sync cycle completes */
  onSyncComplete?: (result: SyncCycleResult) => void;
  /** Callback when sync error occurs */
  onSyncError?: (error: Error) => void;
}

export interface UseDeltaSyncReturn {
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Whether the sync engine is initialized */
  isReady: boolean;
  /** Timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** Array of recent sync errors (for debugging) */
  syncErrors: string[];
  /** Number of records pending sync */
  pendingCount: number;
  /** Number of records with conflicts */
  conflictCount: number;
  /** Force an immediate sync cycle */
  forceSync: () => Promise<SyncCycleResult | null>;
  /** Get conflict records for resolution UI */
  getConflicts: () => Promise<ConflictRecord[]>;
  /** Current sync status */
  status: SyncEngineStatus | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useDeltaSync Hook
 *
 * Provides background sync functionality with React integration.
 *
 * CTO MANDATE: NEVER blocks UI rendering.
 * - Sync runs in background with configurable interval
 * - Uses requestIdleCallback for non-blocking execution
 * - Automatically triggers on app focus and network reconnect
 * - Exposes sync state for UI indicators
 */
export function useDeltaSync(options: UseDeltaSyncOptions): UseDeltaSyncReturn {
  const {
    userId,
    enabled = true,
    config = {},
    onSyncComplete,
    onSyncError,
  } = options;

  const { database, isReady: isDatabaseReady } = useLocalDatabase();

  // State
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [status, setStatus] = useState<SyncEngineStatus | null>(null);

  // Refs
  const engineRef = useRef<IDeltaSyncEngine | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const lastSyncTimeRef = useRef(0);

  // Merged config
  const mergedConfig = { ...DEFAULT_SYNC_CONFIG, ...config };

  // ===========================================================================
  // INITIALIZE ENGINE
  // ===========================================================================

  useEffect(() => {
    if (!isDatabaseReady || !database || !userId || !enabled) {
      return;
    }

    const supabase = createClient();
    engineRef.current = createDeltaSyncEngine(
      database,
      supabase,
      userId,
      mergedConfig
    );
    setIsReady(true);

    return () => {
      engineRef.current = null;
      setIsReady(false);
    };
  }, [isDatabaseReady, database, userId, enabled]);

  // ===========================================================================
  // SYNC EXECUTION
  // ===========================================================================

  /**
   * Run sync cycle with debouncing
   */
  const runSync = useCallback(async (): Promise<SyncCycleResult | null> => {
    if (!engineRef.current || !isMountedRef.current) {
      return null;
    }

    // Debounce: Don't sync if we synced recently
    const now = Date.now();
    if (now - lastSyncTimeRef.current < MIN_SYNC_INTERVAL_MS) {
      return null;
    }
    lastSyncTimeRef.current = now;

    try {
      setIsSyncing(true);

      const result = await engineRef.current.runFullCycle();

      if (isMountedRef.current) {
        if (result.success) {
          setLastSyncedAt(new Date().toISOString());
          setSyncErrors([]);
        } else if (result.error) {
          setSyncErrors((prev) => [...prev.slice(-4), result.error!.message]);
        }

        // Update status
        const newStatus = await engineRef.current.getSyncStatusAsync();
        setStatus(newStatus);
        setPendingCount(newStatus.pendingCount);
        setConflictCount(newStatus.conflictCount);

        onSyncComplete?.(result);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (isMountedRef.current) {
        setSyncErrors((prev) => [...prev.slice(-4), err.message]);
        onSyncError?.(err);
      }

      return null;
    } finally {
      if (isMountedRef.current) {
        setIsSyncing(false);
      }
    }
  }, [onSyncComplete, onSyncError]);

  /**
   * Schedule sync using requestIdleCallback
   *
   * CTO MANDATE: Use requestIdleCallback to avoid UI jank
   */
  const scheduleSync = useCallback(() => {
    if (!isReady || !enabled) return;

    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => runSync(), {
        timeout: IDLE_CALLBACK_TIMEOUT_MS,
      });
    } else {
      // Fallback for Safari
      setTimeout(() => runSync(), 0);
    }
  }, [isReady, enabled, runSync]);

  /**
   * Force sync (exposed to consumers)
   *
   * Bypasses debouncing for immediate sync.
   */
  const forceSync = useCallback(async (): Promise<SyncCycleResult | null> => {
    lastSyncTimeRef.current = 0; // Reset debounce
    return runSync();
  }, [runSync]);

  /**
   * Get conflicts (exposed to consumers)
   */
  const getConflicts = useCallback(async (): Promise<ConflictRecord[]> => {
    if (!engineRef.current) {
      return [];
    }
    return engineRef.current.getConflicts();
  }, []);

  // ===========================================================================
  // INTERVAL SYNC
  // ===========================================================================

  useEffect(() => {
    if (!isReady || !enabled) {
      return;
    }

    // Initial sync on mount
    scheduleSync();

    // Set up interval
    intervalRef.current = setInterval(
      scheduleSync,
      mergedConfig.syncIntervalMs
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isReady, enabled, scheduleSync, mergedConfig.syncIntervalMs]);

  // ===========================================================================
  // FOCUS SYNC
  // ===========================================================================

  useEffect(() => {
    if (!isReady || !enabled || !mergedConfig.syncOnFocus) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isReady, enabled, mergedConfig.syncOnFocus, scheduleSync]);

  // ===========================================================================
  // NETWORK RECONNECT SYNC
  // ===========================================================================

  useEffect(() => {
    if (!isReady || !enabled || !mergedConfig.syncOnReconnect) {
      return;
    }

    const handleOnline = () => {
      if (engineRef.current) {
        engineRef.current.setOnlineStatus(true);
      }
      scheduleSync();
    };

    const handleOffline = () => {
      if (engineRef.current) {
        engineRef.current.setOnlineStatus(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isReady, enabled, mergedConfig.syncOnReconnect, scheduleSync]);

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    isSyncing,
    isReady,
    lastSyncedAt,
    syncErrors,
    pendingCount,
    conflictCount,
    forceSync,
    getConflicts,
    status,
  };
}

// ============================================================================
// SYNC TRIGGER HOOK
// ============================================================================

/**
 * Hook for triggering sync after mutations
 *
 * Use this in mutation hooks to trigger sync after local writes.
 *
 * @example
 * ```tsx
 * const { triggerSync } = useSyncTrigger();
 *
 * const handleCreate = async () => {
 *   await createTransaction(data);
 *   triggerSync(); // Trigger sync after mutation
 * };
 * ```
 */
export function useSyncTrigger() {
  const syncTriggerRef = useRef<(() => void) | null>(null);

  const registerSyncTrigger = useCallback((trigger: () => void) => {
    syncTriggerRef.current = trigger;
  }, []);

  const triggerSync = useCallback(() => {
    syncTriggerRef.current?.();
  }, []);

  return { registerSyncTrigger, triggerSync };
}

// ============================================================================
// SYNC PROVIDER CONTEXT (Optional)
// ============================================================================

export interface SyncContextValue {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  conflictCount: number;
  forceSync: () => Promise<SyncCycleResult | null>;
}

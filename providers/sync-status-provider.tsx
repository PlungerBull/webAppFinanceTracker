'use client';

/**
 * Sync Status Provider
 *
 * Manages sync lifecycle and user notifications.
 * Wires the useDeltaSync hook to the Sonner toast system.
 * Exposes sync state via context for UI components (banner, modal).
 *
 * CTO MANDATES:
 * - Toast Debounce: Track conflict IDs (Set), not counts - notify on NEW IDs only
 * - Offline Silence: Do NOT toast for standard network loss
 * - Accurate UX Copy: No "preservation lie" - be precise about what happened
 * - Calm Financial App: Use warning not error for conflicts
 *
 * @module providers/sync-status-provider
 */

import { createContext, useContext, useRef } from 'react';
import { toast } from 'sonner';
import * as Sentry from '@sentry/nextjs';
import { useAuthStore } from '@/stores/auth-store';
import { useDeltaSync } from '@/lib/sync';
import type { ReactNode } from 'react';
import type { ConflictRecord, SyncCycleResult } from '@/lib/sync';

// ============================================================================
// CONTEXT
// ============================================================================

interface SyncStatusContextValue {
  /** Number of records in conflict state */
  conflictCount: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Last successful sync timestamp (ISO string) */
  lastSyncedAt: string | null;
  /** Number of records pending sync */
  pendingCount: number;
  /** Get detailed conflict records for resolution UI */
  getConflicts: () => Promise<ConflictRecord[]>;
  /** Delete a conflict record permanently from local storage */
  deleteConflict: (
    id: string,
    tableName: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Retry a conflict record (reset to pending and trigger sync) */
  retryConflict: (
    id: string,
    tableName: string
  ) => Promise<{ success: boolean; error?: string; syncTriggered: boolean }>;
  /** Force an immediate sync cycle */
  forceSync: () => Promise<SyncCycleResult | null>;
}

const SyncStatusContext = createContext<SyncStatusContextValue | null>(null);

/**
 * Hook to access sync status from context.
 * Must be used within SyncStatusProvider.
 */
export function useSyncStatus(): SyncStatusContextValue {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within SyncStatusProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

interface SyncStatusProviderProps {
  children: ReactNode;
}

/**
 * Collect all conflict IDs from push results across all tables
 */
function collectConflictIds(
  results: Array<{ conflictIds: string[] }> | undefined
): string[] {
  if (!results) return [];
  return results.flatMap((r) => r.conflictIds);
}

export function SyncStatusProvider({ children }: SyncStatusProviderProps) {
  const userId = useAuthStore((state) => state.user?.id);

  /* react-compiler-ignore: DEBOUNCE_METADATA
   * Toast debounce ref for tracking notified conflict IDs.
   * Ref mutations occur INSIDE the onSyncComplete callback (not render phase).
   * This is silent metadata for deduplication - should NOT trigger UI re-renders.
   */
  // CTO Mandate: Track conflict IDs (Set) not count
  // Prevents "Toast Spam" when total count stays same but IDs change
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const syncState = useDeltaSync({
    userId,
    onSyncComplete: (result) => {
      // 🛡️ Capture silent sync failures (success:false without a thrown exception)
      if (!result.success) {
        Sentry.captureMessage('Sync cycle completed with failures', {
          level: 'warning',
          tags: {
            domain: 'sync',
            'sync.outcome': 'silent_failure',
          },
          extra: {
            durationMs: result.durationMs,
            pushSuccess: result.pushResult?.success ?? null,
            pullSuccess: result.pullResult?.success ?? null,
          },
        });
      }

      const currentConflictIds = collectConflictIds(result.pushResult?.results);

      // Check if ANY new conflict IDs exist that we haven't notified about
      const hasNewConflicts = currentConflictIds.some(
        (id) => !notifiedIdsRef.current.has(id)
      );

      if (hasNewConflicts && currentConflictIds.length > 0) {
        toast.warning(`${currentConflictIds.length} sync conflict(s) detected`, {
          description:
            'Changes from another device were detected. Review conflicts to ensure your data is accurate.',
        });
        // Update the set with current conflict IDs
        notifiedIdsRef.current = new Set(currentConflictIds);
      } else if (currentConflictIds.length === 0) {
        // All conflicts resolved - clear the set
        notifiedIdsRef.current.clear();
      }
    },
    onSyncError: (error) => {
      // Report all sync errors to Sentry (PII scrubbed by beforeSend)
      Sentry.captureException(error, {
        tags: { domain: 'sync' },
      });

      // CTO Mandate: Do NOT toast for standard network loss
      // Only toast for persistent auth/data errors
      const message = error.message.toLowerCase();
      if (message.includes('auth') || message.includes('unauthorized')) {
        toast.error('Sync authentication failed', {
          description: 'Please sign in again to continue syncing.',
        });
      }
      // Network errors are silent - the sync engine will retry automatically
    },
  });

  // Build context value from sync state
  const contextValue: SyncStatusContextValue = {
    conflictCount: syncState.conflictCount,
    isSyncing: syncState.isSyncing,
    lastSyncedAt: syncState.lastSyncedAt,
    pendingCount: syncState.pendingCount,
    getConflicts: syncState.getConflicts,
    deleteConflict: syncState.deleteConflict,
    retryConflict: syncState.retryConflict,
    forceSync: syncState.forceSync,
  };

  return (
    <SyncStatusContext.Provider value={contextValue}>
      {children}
    </SyncStatusContext.Provider>
  );
}

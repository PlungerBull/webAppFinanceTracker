'use client';

/**
 * Sync Status Provider
 *
 * Manages sync lifecycle and user notifications.
 * Wires the useDeltaSync hook to the Sonner toast system.
 *
 * CTO MANDATES:
 * - Toast Debounce: Track conflict IDs (Set), not counts - notify on NEW IDs only
 * - Offline Silence: Do NOT toast for standard network loss
 * - Accurate UX Copy: No "preservation lie" - be precise about what happened
 * - Calm Financial App: Use warning not error for conflicts
 *
 * @module providers/sync-status-provider
 */

import { useRef } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useDeltaSync } from '@/lib/sync';
import type { ReactNode } from 'react';

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

  // CTO Mandate: Track conflict IDs (Set) not count
  // Prevents "Toast Spam" when total count stays same but IDs change
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useDeltaSync({
    userId,
    onSyncComplete: (result) => {
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

  return <>{children}</>;
}

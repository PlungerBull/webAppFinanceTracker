'use client';

/**
 * Sync Conflict Banner
 *
 * Displays a persistent warning banner when sync conflicts are detected.
 * Provides users with actionable feedback instead of silent failures.
 *
 * CTO MANDATE: Users must know when their data isn't syncing.
 *
 * @module components/sync-conflict-banner
 */

import { useState } from 'react';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncConflictModal } from './sync-conflict-modal';
import { useSyncStatus } from '@/providers/sync-status-provider';

export function SyncConflictBanner() {
  const { conflictCount } = useSyncStatus();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if no conflicts or dismissed
  if (conflictCount === 0 || isDismissed) return null;

  return (
    <>
      <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-4 rounded-r-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {conflictCount} item{conflictCount > 1 ? 's' : ''} could not be
              synced
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Some data may not be saved to the server. Review to resolve.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Review Issues
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDismissed(true)}
            className="text-amber-600 hover:text-amber-800 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <SyncConflictModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}

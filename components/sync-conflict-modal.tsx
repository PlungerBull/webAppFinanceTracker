'use client';

/**
 * Sync Conflict Modal
 *
 * Displays detailed information about sync conflicts and provides
 * actions for resolution (delete locally or retry sync).
 *
 * CTO MANDATE: Actionable error handling, not just error messages.
 *
 * @module components/sync-conflict-modal
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSyncStatus } from '@/providers/sync-status-provider';
import type { ConflictRecord } from '@/lib/sync/types';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncConflictModal({ isOpen, onClose }: SyncConflictModalProps) {
  const { getConflicts, forceSync } = useSyncStatus();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Load conflicts when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getConflicts()
        .then(setConflicts)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, getConflicts]);

  const handleRetrySync = async () => {
    setIsRetrying(true);
    try {
      await forceSync();
      // Reload conflicts after retry
      const updated = await getConflicts();
      setConflicts(updated);
      if (updated.length === 0) {
        onClose();
      }
    } catch (error) {
      console.error('[SyncConflictModal] Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const getTableDisplayName = (tableName: string): string => {
    const names: Record<string, string> = {
      bank_accounts: 'Account',
      transactions: 'Transaction',
      categories: 'Category',
      transaction_inbox: 'Inbox Item',
    };
    return names[tableName] || tableName;
  };

  const getRecordDescription = (conflict: ConflictRecord): string => {
    const data = conflict.localData;
    if (data.name) return String(data.name);
    if (data.description) return String(data.description);
    return `ID: ${conflict.id.slice(0, 8)}...`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Sync Issues
          </DialogTitle>
          <DialogDescription>
            The following items could not be synced to the server. This may be
            due to missing required data or version conflicts.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conflicts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync conflicts found
            </div>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((conflict) => (
                <li
                  key={conflict.id}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                        {getTableDisplayName(conflict.tableName)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium truncate">
                      {getRecordDescription(conflict)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Local v{conflict.localVersion} vs Server v
                      {conflict.serverVersion}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      // TODO: Implement delete locally
                      console.log('Delete locally:', conflict.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handleRetrySync} disabled={isRetrying}>
            {isRetrying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Sync
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

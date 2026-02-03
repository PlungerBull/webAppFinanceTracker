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
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import { useSyncStatus } from '@/providers/sync-status-provider';
import type { ConflictRecord } from '@/lib/sync/types';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncConflictModal({ isOpen, onClose }: SyncConflictModalProps) {
  const { getConflicts, forceSync, deleteConflict, retryConflict } = useSyncStatus();
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConflictRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteConflict(deleteTarget.id, deleteTarget.tableName);

      if (result.success) {
        // Remove from local state
        setConflicts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        setDeleteTarget(null);

        toast.success('Conflict resolved', {
          description: 'The local version has been discarded.',
        });

        // If no more conflicts, close the modal
        if (conflicts.length === 1) {
          onClose();
        }
      } else {
        setDeleteError(result.error || 'Failed to delete conflict');
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryItem = async (conflict: ConflictRecord) => {
    setRetryingId(conflict.id);

    try {
      const result = await retryConflict(conflict.id, conflict.tableName);

      if (result.success) {
        // Remove from local state (it's now pending, not conflict)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id));

        toast.success('Retry queued', {
          description: result.syncTriggered
            ? 'The item is being synced now.'
            : 'The item will be synced shortly.',
        });

        // If no more conflicts, close the modal
        if (conflicts.length === 1) {
          onClose();
        }
      } else {
        toast.error('Retry failed', {
          description: result.error || 'Could not reset the record for retry.',
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      toast.error('Retry failed', { description: message });
    } finally {
      setRetryingId(null);
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
                  {/* Retry Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    onClick={() => handleRetryItem(conflict)}
                    disabled={retryingId === conflict.id}
                  >
                    {retryingId === conflict.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  {/* Delete Button - ALSO disabled when retrying this row */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(conflict)}
                    disabled={retryingId === conflict.id}
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

        {/* Delete Confirmation Dialog */}
        <DeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          title="Discard Local Changes?"
          description={
            <>
              <p>
                This will permanently delete the local version of this{' '}
                <strong>
                  {deleteTarget ? getTableDisplayName(deleteTarget.tableName) : 'item'}
                </strong>
                .
              </p>
              <p className="mt-2">
                {deleteTarget?.serverData
                  ? 'The server version will be preserved.'
                  : 'This data exists only locally and will be lost.'}
              </p>
              <p className="mt-2 text-amber-600 dark:text-amber-400">
                This action cannot be undone.
              </p>
            </>
          }
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
          error={deleteError}
          confirmLabel="Discard Local"
          cancelLabel="Keep"
        />
      </DialogContent>
    </Dialog>
  );
}

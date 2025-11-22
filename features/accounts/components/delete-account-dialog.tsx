'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { accountsApi } from '../api/accounts';
import type { Database } from '@/types/database.types';
import { QUERY_KEYS } from '@/lib/constants';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { ACCOUNT_UI } from '@/lib/constants';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

export function DeleteAccountDialog({ open, onOpenChange, account }: DeleteAccountDialogProps) {
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!account) return;

    try {
      setIsDeleting(true);
      setError(null);

      await accountsApi.delete(account.id);

      // Invalidate accounts query to refresh the list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });

      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : ACCOUNT_UI.MESSAGES.DELETE_FAILED);
      console.error(ACCOUNT_UI.MESSAGES.DELETE_FAILED, err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{ACCOUNT_UI.LABELS.DELETE_ACCOUNT}</AlertDialogTitle>
          <AlertDialogDescription>
            {ACCOUNT_UI.MESSAGES.DELETE_CONFIRMATION}
            <br />
            <strong>{account?.name}</strong>
            <br />
            <span className="text-red-500 mt-2 block">
              {ACCOUNT_UI.MESSAGES.DELETE_WARNING}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{ACCOUNT_UI.BUTTONS.CANCEL}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {ACCOUNT_UI.BUTTONS.DELETE}...
              </>
            ) : (
              ACCOUNT_UI.BUTTONS.DELETE
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

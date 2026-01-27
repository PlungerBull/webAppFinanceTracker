'use client';

import { useState } from 'react';
import { useDeleteAccount } from '../hooks/use-account-mutations';
import { ACCOUNT_UI } from '@/lib/constants';
import { DeleteDialog } from '@/components/shared/delete-dialog';
import type { Account } from '@/types/domain';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
}

export function DeleteAccountDialog({ open, onOpenChange, account }: DeleteAccountDialogProps) {
  const deleteAccountMutation = useDeleteAccount();
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (account?.id && account?.version !== undefined) {
      setError(null);
      try {
        await deleteAccountMutation.mutateAsync({ id: account.id, version: account.version });
        onOpenChange(false);
      } catch (err) {
        // Error toast is handled by the hook's onError
        // Set local error for inline display if needed
        setError(err instanceof Error ? err.message : 'Failed to delete account');
      }
    }
  };

  return (
    <DeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={ACCOUNT_UI.LABELS.DELETE_ACCOUNT}
      description={
        <>
          {ACCOUNT_UI.MESSAGES.DELETE_CONFIRMATION}
          <br />
          <strong>{account?.name}</strong>
          <br />
          <span className="text-red-500 mt-2 block">
            {ACCOUNT_UI.MESSAGES.DELETE_WARNING}
          </span>
        </>
      }
      onConfirm={onDelete}
      isDeleting={deleteAccountMutation.isPending}
      error={error}
      confirmLabel={ACCOUNT_UI.BUTTONS.DELETE}
      cancelLabel={ACCOUNT_UI.BUTTONS.CANCEL}
    />
  );
}

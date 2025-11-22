'use client';

import { useDeleteItem } from '@/hooks/shared/use-delete-item';
import { accountsApi } from '../api/accounts';
import type { Database } from '@/types/database.types';
import { QUERY_KEYS } from '@/lib/constants';
import { ACCOUNT_UI } from '@/lib/constants';
import { DeleteDialog } from '@/components/shared/delete-dialog';

type BankAccount = Database['public']['Tables']['bank_accounts']['Row'];

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: BankAccount | null;
}

export function DeleteAccountDialog({ open, onOpenChange, account }: DeleteAccountDialogProps) {
  const { handleDelete, isDeleting, error } = useDeleteItem(
    accountsApi.delete,
    [QUERY_KEYS.ACCOUNTS]
  );

  const onDelete = async () => {
    if (account?.id) {
      await handleDelete(account.id);
      onOpenChange(false);
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
      isDeleting={isDeleting}
      error={error}
      confirmLabel={ACCOUNT_UI.BUTTONS.DELETE}
      cancelLabel={ACCOUNT_UI.BUTTONS.CANCEL}
    />
  );
}

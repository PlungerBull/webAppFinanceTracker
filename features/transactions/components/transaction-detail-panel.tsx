'use client';

import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { TransactionDetailPanel as SharedPanel } from '@/features/shared/components/transaction-detail-panel';
import type { PanelData, SelectableAccount, SelectableCategory } from '@/features/shared/components/transaction-detail-panel';
import { useUpdateTransactionBatch, useDeleteTransaction } from '../hooks/use-transactions';
import { useTransactionSelection } from '@/stores/transaction-selection-store';
import type { TransactionViewEntity } from '../domain';
import type { AccountViewEntity } from '@/features/accounts/domain';
import type { LeafCategoryEntity } from '@/features/categories/domain';
import { cn } from '@/lib/utils';

interface TransactionDetailPanelProps {
  transaction: TransactionViewEntity | null;
  accountId: string | null;
  categories: LeafCategoryEntity[];
  accounts: AccountViewEntity[]; // Use AccountViewEntity from Repository Pattern
}

export function TransactionDetailPanel({
  transaction,
  accountId,
  categories,
  accounts,
}: TransactionDetailPanelProps) {
  const updateMutation = useUpdateTransactionBatch();
  const deleteMutation = useDeleteTransaction();

  // Transform TransactionRow to PanelData
  // Converts null → undefined for consistency with PanelData interface
  const panelData: PanelData | null = useMemo(() => {
    if (!transaction) return null;

    return {
      id: transaction.id,
      description: transaction.description ?? undefined,
      amountOriginal: transaction.amountCents / 100, // Convert integer cents to decimal
      currency: transaction.currencyOriginal,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId ?? undefined,
      date: transaction.date,
      notes: transaction.notes ?? undefined,
      exchangeRate: transaction.exchangeRate ?? undefined,
      reconciliationId: transaction.reconciliationId ?? undefined,
      cleared: transaction.cleared ?? false,
    };
  }, [transaction]);

  // Transform accounts to SelectableAccount format
  const selectableAccounts: SelectableAccount[] = useMemo(
    () =>
      accounts
        .filter((account): account is typeof account & { id: string; name: string; currencyCode: string } =>
          Boolean(account.id && account.name && account.currencyCode)
        )
        .map((account) => ({
          id: account.id,
          name: account.name,
          currencyCode: account.currencyCode,
          color: account.color || undefined,
        })),
    [accounts]
  );

  // Transform categories to SelectableCategory format
  const selectableCategories: SelectableCategory[] = useMemo(
    () =>
      categories
        .filter((cat) => cat.id !== null) // Filter out null IDs
        .map((cat) => ({
          id: cat.id!,
          name: cat.name || 'Unnamed Category',
          color: cat.color || '#3b82f6',
          type: (cat.type as 'income' | 'expense') || 'expense',
        })),
    [categories]
  );

  // Handle save (batch update)
  const handleSave = async (updates: {
    description?: string;
    amount?: number;
    accountId?: string;
    categoryId?: string;
    date?: string;
    notes?: string;
  }) => {
    if (!transaction) return;

    await updateMutation.mutateAsync({
      id: transaction.id,
      version: transaction.version,
      updates,
    });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!transaction) return;
    await deleteMutation.mutateAsync({ id: transaction.id, version: transaction.version });
  };

  // Handle close (no-op, panel is always visible)
  const handleClose = () => {
    // In the current implementation, the panel is always visible when a transaction is selected
    // We don't have a close mechanism, but this satisfies the shared panel interface
  };

  if (!panelData) {
    return (
      <div className="w-[400px] bg-white border-l border-gray-200 flex items-center justify-center text-gray-500">
        <p className="text-sm">Select a transaction to view details</p>
      </div>
    );
  }

  return (
    <SharedPanel
      mode="transaction"
      data={panelData}
      accounts={selectableAccounts}
      categories={selectableCategories}
      onSave={handleSave}
      onDelete={handleDelete}
      onClose={handleClose}
      isLoading={updateMutation.isPending || deleteMutation.isPending}
    />
  );
}

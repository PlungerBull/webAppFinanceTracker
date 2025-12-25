'use client';

import { useMemo } from 'react';
import { TransactionDetailPanel as SharedPanel } from '@/features/shared/components/transaction-detail-panel';
import type { PanelData, SelectableAccount, SelectableCategory } from '@/features/shared/components/transaction-detail-panel';
import { usePromoteInboxItem, useDismissInboxItem } from '../hooks/use-inbox';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import type { InboxItem } from '../types';
import { toast } from 'sonner';
import { INBOX } from '@/lib/constants';

interface InboxDetailPanelProps {
  item: InboxItem | null;
}

export function InboxDetailPanel({ item }: InboxDetailPanelProps) {
  const promoteMutation = usePromoteInboxItem();
  const dismissMutation = useDismissInboxItem();
  const { data: categories = [] } = useCategories();
  const { data: accountsData = [] } = useGroupedAccounts();

  // Transform InboxItem to PanelData
  const panelData: PanelData | null = useMemo(() => {
    if (!item) return null;

    return {
      id: item.id,
      description: item.description,
      amount: item.amount,
      currency: item.currency,
      accountId: item.accountId,
      categoryId: item.categoryId,
      date: item.date,
      notes: null, // Inbox doesn't have notes yet
    };
  }, [item]);

  // Flatten accounts for the detail panel
  const selectableAccounts: SelectableAccount[] = useMemo(
    () =>
      accountsData.flatMap((group) =>
        group.balances.map((balance) => ({
          id: balance.accountId,
          name: `${group.name} (${balance.currency})`,
          currencyCode: balance.currency,
          color: group.color,
        }))
      ),
    [accountsData]
  );

  // Transform categories to SelectableCategory format
  const selectableCategories: SelectableCategory[] = useMemo(
    () =>
      categories
        .filter((cat) => cat.id !== null)
        .map((cat) => ({
          id: cat.id!,
          name: cat.name || 'Unnamed Category',
          color: cat.color || '#3b82f6',
          type: (cat.type as 'income' | 'expense') || 'expense',
        })),
    [categories]
  );

  // Handle save (promote to ledger)
  const handleSave = async (updates: {
    description?: string;
    amount?: number;
    accountId?: string;
    categoryId?: string;
    date?: string;
    notes?: string;
  }) => {
    if (!item) return;

    // Extract required fields with fallbacks to item data
    const accountId = updates.accountId || item.accountId;
    const categoryId = updates.categoryId || item.categoryId;
    const finalDescription = updates.description || item.description;
    const finalAmount = updates.amount ?? item.amount;
    const finalDate = updates.date || item.date || new Date().toISOString();

    if (!accountId || !categoryId) {
      toast.error('Account and Category are required to promote to ledger');
      return;
    }

    try {
      await promoteMutation.mutateAsync({
        inboxId: item.id,
        accountId,
        categoryId,
        finalDescription,
        finalAmount,
        finalDate,
      });
      toast.success(INBOX.UI.MESSAGES.PROMOTE_SUCCESS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : INBOX.API.ERRORS.PROMOTE_FAILED);
    }
  };

  // Handle delete (dismiss)
  const handleDelete = async () => {
    if (!item) return;

    try {
      await dismissMutation.mutateAsync(item.id);
      toast.success(INBOX.UI.MESSAGES.DISMISS_SUCCESS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : INBOX.API.ERRORS.DISMISS_FAILED);
    }
  };

  // Handle close (no-op)
  const handleClose = () => {
    // Panel is always visible when item is selected
  };

  if (!panelData) {
    return (
      <div className="w-[400px] bg-white border-l border-gray-200 flex items-center justify-center text-gray-500">
        <p className="text-sm">Select an item to review</p>
      </div>
    );
  }

  return (
    <SharedPanel
      mode="inbox"
      data={panelData}
      accounts={selectableAccounts}
      categories={selectableCategories}
      onSave={handleSave}
      onDelete={handleDelete}
      onClose={handleClose}
      isLoading={promoteMutation.isPending || dismissMutation.isPending}
    />
  );
}

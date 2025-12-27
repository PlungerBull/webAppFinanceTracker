'use client';

import { useMemo } from 'react';
import { TransactionDetailPanel as SharedPanel } from '@/features/shared/components/transaction-detail-panel';
import type { PanelData, SelectableAccount, SelectableCategory } from '@/features/shared/components/transaction-detail-panel';
import { usePromoteInboxItem, useDismissInboxItem, useUpdateInboxDraft } from '../hooks/use-inbox';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import type { InboxItem } from '../types';
import { toast } from 'sonner';
import { INBOX } from '@/lib/constants';

interface InboxDetailPanelProps {
  item: InboxItem | null;
}

export function InboxDetailPanel({ item }: InboxDetailPanelProps) {
  const promoteMutation = usePromoteInboxItem();
  const dismissMutation = useDismissInboxItem();
  const updateDraftMutation = useUpdateInboxDraft();
  const { data: categories = [] } = useCategories();
  const { data: accountsData = [] } = useAccounts();

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
      notes: undefined, // Inbox doesn't have notes yet
    };
  }, [item]);

  // Transform flat accounts for the detail panel
  const selectableAccounts: SelectableAccount[] = useMemo(
    () =>
      accountsData.map((account) => ({
        id: account.accountId!,
        name: account.name!,
        currencyCode: account.currencyCode!,
        currencySymbol: account.currencySymbol!,
        color: account.color || '#3b82f6',
      })),
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

  // Handle save with AUTO-PROMOTION and MULTI-CURRENCY GATEKEEPER
  const handleSave = async (updates: {
    description?: string;
    amount?: number;
    accountId?: string;
    categoryId?: string;
    date?: string;
    notes?: string;
    exchangeRate?: number;
  }) => {
    if (!item) return;

    // Extract final values with fallbacks to item data
    const finalAmount = updates.amount ?? item.amount;
    const finalDescription = updates.description ?? item.description;
    const accountId = updates.accountId || item.accountId;
    const categoryId = updates.categoryId || item.categoryId;
    const finalDate = updates.date || item.date || new Date().toISOString();
    const finalExchangeRate = updates.exchangeRate ?? item.exchangeRate;

    // Get selected account for currency check
    const selectedAccount = accountsData.find(a => a.accountId === accountId);
    const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== item.currency;

    // MULTI-CURRENCY GATEKEEPER: Block if exchange rate is missing when required
    if (requiresExchangeRate && (!finalExchangeRate || finalExchangeRate === 0)) {
      toast.error('Exchange rate is required for cross-currency transactions');
      return;
    }

    // Check if all required fields are now present (completeness check)
    const isComplete =
      accountId &&
      categoryId &&
      finalAmount !== undefined &&
      finalDescription?.trim() &&
      (!requiresExchangeRate || finalExchangeRate); // Exchange rate required if currencies differ

    try {
      if (isComplete) {
        // AUTO-PROMOTE: All fields present → move to ledger with "vanishing effect"
        await promoteMutation.mutateAsync({
          inboxId: item.id,
          accountId: accountId!,
          categoryId: categoryId!,
          finalDescription: finalDescription!,
          finalAmount: finalAmount!,
          finalDate,
        });
        toast.success('Moved to transaction ledger');
      } else {
        // PARTIAL UPDATE: Some fields missing → update inbox item
        await updateDraftMutation.mutateAsync({
          id: item.id,
          updates: {
            amount: finalAmount ?? null,
            description: finalDescription ?? null,
            accountId: accountId ?? null,
            categoryId: categoryId ?? null,
            date: finalDate ?? null,
            exchangeRate: finalExchangeRate ?? null,
          }
        });
        toast.success('Draft updated');
      }
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

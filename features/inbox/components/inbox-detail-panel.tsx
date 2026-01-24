'use client';

import { useMemo } from 'react';
import { TransactionDetailPanel as SharedPanel } from '@/features/shared/components/transaction-detail-panel';
import type { PanelData, SelectableAccount, SelectableCategory } from '@/features/shared/components/transaction-detail-panel';
import { usePromoteInboxItem, useDismissInboxItem, useUpdateInboxDraft } from '../hooks/use-inbox';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import type { InboxItemViewEntity } from '../domain/entities';
import { toast } from 'sonner';
import { INBOX } from '@/lib/constants';

interface InboxDetailPanelProps {
  item: InboxItemViewEntity | null;
}

export function InboxDetailPanel({ item }: InboxDetailPanelProps) {
  const promoteMutation = usePromoteInboxItem();
  const dismissMutation = useDismissInboxItem();
  const updateDraftMutation = useUpdateInboxDraft();
  const leafCategories = useLeafCategories();
  const { data: accountsData = [] } = useAccounts();

  // Transform InboxItemViewEntity to PanelData
  const panelData: PanelData | null = useMemo(() => {
    if (!item) return null;

    return {
      id: item.id,
      description: item.description ?? undefined,
      displayAmount: item.amountCents !== null ? item.amountCents / 100 : undefined,  // Convert cents to dollars for display
      currency: item.currencyCode ?? '',  // Required field - empty string if no account selected yet
      accountId: item.accountId ?? undefined,
      categoryId: item.categoryId ?? undefined,
      date: item.date ?? undefined,
      notes: item.notes ?? undefined,
      sourceText: item.sourceText ?? undefined,
    };
  }, [item]);

  // Transform flat accounts for the detail panel
  const selectableAccounts: SelectableAccount[] = useMemo(
    () =>
      accountsData
        .filter((account): account is typeof account & { id: string; name: string; currencyCode: string } =>
          Boolean(account.id && account.name && account.currencyCode)
        )
        .map((account) => ({
          id: account.id,
          name: account.name,
          currencyCode: account.currencyCode,
          color: account.color || '#3b82f6',
        })),
    [accountsData]
  );

  // Transform leaf categories to SelectableCategory format
  const selectableCategories: SelectableCategory[] = useMemo(
    () =>
      leafCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        type: cat.type,
      })),
    [leafCategories]
  );

  // Handle partial save - Update draft without promoting
  // Used when item is incomplete (missing required fields)
  const handlePartialSave = async (updates: {
    description?: string;
    amount?: number;
    accountId?: string;
    categoryId?: string;
    date?: string;
    notes?: string;
    exchangeRate?: number;
  }) => {
    if (!item) return;

    // Extract final values with fallbacks (null → undefined conversion at boundary)
    const finalAmount = updates.amount ?? (item.amountCents !== null ? item.amountCents / 100 : undefined);
    const finalDescription = updates.description ?? item.description ?? undefined;
    const accountId = updates.accountId ?? item.accountId ?? undefined;
    const categoryId = updates.categoryId ?? item.categoryId ?? undefined;
    const finalDate = updates.date ?? item.date ?? new Date().toISOString();
    const finalExchangeRate = updates.exchangeRate ?? item.exchangeRate ?? undefined;
    const finalNotes = updates.notes ?? item.notes ?? undefined;

    try {
      await updateDraftMutation.mutateAsync({
        id: item.id,
        updates: {
          amountCents: finalAmount !== undefined ? Math.round(finalAmount * 100) : null,  // Convert dollars to cents
          description: finalDescription ?? null,
          accountId: accountId ?? null,
          categoryId: categoryId ?? null,
          date: finalDate ?? null,
          exchangeRate: finalExchangeRate ?? null,
          notes: finalNotes ?? null,                                 // NEW
        }
      });
      toast.success('Draft saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save draft');
    }
  };

  // Handle promotion - Move to ledger (all fields required)
  // This handler is ONLY called when item is ledger-ready
  const handlePromote = async (updates: {
    description?: string;
    amount?: number;
    accountId?: string;
    categoryId?: string;
    date?: string;
    notes?: string;
    exchangeRate?: number;
  }) => {
    if (!item) return;

    // Extract final values with fallbacks (null → undefined conversion at boundary)
    const finalAmount = updates.amount ?? (item.amountCents !== null ? item.amountCents / 100 : undefined);
    const finalDescription = updates.description ?? item.description ?? undefined;
    const accountId = updates.accountId ?? item.accountId ?? undefined;
    const categoryId = updates.categoryId ?? item.categoryId ?? undefined;
    const finalDate = updates.date ?? item.date ?? new Date().toISOString();

    // SAFETY CHECK: These should never be null/undefined here
    // because readiness calculator ensures they're present
    if (!accountId || !categoryId) {
      toast.error('Account and category are required');
      return;
    }

    // Get selected account for currency check
    const selectedAccount = accountsData.find(a => a.id === accountId);
    const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== item.currencyCode;
    const finalExchangeRate = updates.exchangeRate ?? item.exchangeRate ?? undefined;

    // MULTI-CURRENCY GATEKEEPER: Block if exchange rate is missing when required
    if (requiresExchangeRate && (!finalExchangeRate || finalExchangeRate === 0)) {
      toast.error('Exchange rate is required for cross-currency transactions');
      return;
    }

    try {
      // ⚠️ ATOMIC PROMOTION REQUIREMENT (CTO Critical)
      // MUST use promote_inbox_item RPC - atomic database operation
      // Ensures inbox → ledger move happens in single transaction
      // NEVER replace with manual INSERT + DELETE pattern
      await promoteMutation.mutateAsync({
        inboxId: item.id,
        accountId: accountId,
        categoryId: categoryId,
        finalDescription: finalDescription ?? '',
        finalAmountCents: finalAmount !== undefined ? Math.round(finalAmount * 100) : 0,  // Convert dollars to integer cents
        finalDate,
        exchangeRate: finalExchangeRate,
      });
      toast.success('Moved to transaction ledger');
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
      onPartialSave={handlePartialSave}
      onPromote={handlePromote}
      onDelete={handleDelete}
      onClose={handleClose}
      isLoading={promoteMutation.isPending || dismissMutation.isPending || updateDraftMutation.isPending}
    />
  );
}

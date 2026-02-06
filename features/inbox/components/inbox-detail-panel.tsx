'use client';

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TransactionDetailPanel as SharedPanel } from '@/components/shared/transaction-detail-panel';
import type { InboxPanelData, SelectableAccount, SelectableCategory, EditedFields } from '@/components/shared/transaction-detail-panel';
import { usePromoteInboxItem, useDismissInboxItem, useUpdateInboxDraft } from '../hooks/use-inbox';
import { useReferenceData } from '@/lib/hooks/use-reference-data';
import type { InboxItemViewEntity } from '@/domain/inbox';
import { toast } from 'sonner';
import { INBOX } from '@/lib/constants';
import { displayAmountToCents } from '@/lib/utils/cents-parser';

interface InboxDetailPanelProps {
  item: InboxItemViewEntity | null;
}

/**
 * Inbox Detail Panel
 *
 * Uses useReferenceData from lib/ to avoid feature-to-feature coupling.
 */
export function InboxDetailPanel({ item }: InboxDetailPanelProps) {
  const queryClient = useQueryClient();
  const promoteMutation = usePromoteInboxItem();
  const dismissMutation = useDismissInboxItem();
  const updateDraftMutation = useUpdateInboxDraft();
  const { accounts: accountsData, categories: leafCategories } = useReferenceData();


  // Transform InboxItemViewEntity to PanelData
  // CTO MANDATE: No null → undefined conversions. PanelData uses null semantics.
  const panelData: InboxPanelData | null = useMemo(() => {
    if (!item) return null;

    return {
      id: item.id,
      description: item.description,
      displayAmount: item.amountCents !== null ? item.amountCents / 100 : null,
      currency: item.currencyCode,
      accountId: item.accountId,
      categoryId: item.categoryId,
      date: item.date,
      notes: item.notes,
      sourceText: item.sourceText,
      exchangeRate: item.exchangeRate,
      reconciliationId: null,  // Inbox items are not reconciled
      cleared: false,          // Inbox items are not cleared
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
  // CTO MANDATE: EditedFields uses null semantics. No undefined conversions.
  const handlePartialSave = async (updates: EditedFields) => {
    if (!item) return;

    // Extract final values: undefined = not edited (use item value), null = cleared, value = new value
    const finalDisplayAmount = updates.displayAmount !== undefined ? updates.displayAmount : (item.amountCents !== null ? item.amountCents / 100 : null);
    const finalDescription = updates.description !== undefined ? updates.description : item.description;
    const finalAccountId = updates.accountId !== undefined ? updates.accountId : item.accountId;
    const finalCategoryId = updates.categoryId !== undefined ? updates.categoryId : item.categoryId;
    const finalDate = updates.date !== undefined ? updates.date : (item.date ?? new Date().toISOString());
    const finalExchangeRate = updates.exchangeRate !== undefined ? updates.exchangeRate : item.exchangeRate;
    const finalNotes = updates.notes !== undefined ? updates.notes : item.notes;

    try {
      await updateDraftMutation.mutateAsync({
        id: item.id,
        updates: {
          amountCents: finalDisplayAmount !== null ? displayAmountToCents(finalDisplayAmount) : null,
          description: finalDescription,
          accountId: finalAccountId,
          categoryId: finalCategoryId,
          date: finalDate,
          exchangeRate: finalExchangeRate,
          notes: finalNotes,
        }
      });
      toast.success('Draft saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save draft');
    }
  };

  // Handle promotion - Move to ledger (all fields required)
  // This handler is ONLY called when item is ledger-ready
  // CTO MANDATE: EditedFields uses null semantics. No type weakening.
  const handlePromote = async (updates: EditedFields) => {
    if (!item) return;

    // S-Tier OCC Guard: Block promotion when version is suspicious (ghost version)
    // A version <= 0 indicates stale local state — force a data refresh before allowing promotion
    if (!item.version || item.version <= 0) {
      toast.error('Item data is stale. Refreshing — please try again.');
      queryClient.invalidateQueries({ queryKey: INBOX.QUERY_KEYS.ALL });
      return;
    }

    // Extract final values: undefined = not edited, null = cleared, value = new value
    // For promotion, null means "use item value" (user cleared but we need a value)
    const finalDisplayAmount = updates.displayAmount !== undefined
      ? (updates.displayAmount ?? (item.amountCents !== null ? item.amountCents / 100 : null))
      : (item.amountCents !== null ? item.amountCents / 100 : null);
    const finalDescription = updates.description !== undefined
      ? (updates.description ?? item.description)
      : item.description;
    const accountId = updates.accountId !== undefined
      ? (updates.accountId ?? item.accountId)
      : item.accountId;
    const categoryId = updates.categoryId !== undefined
      ? (updates.categoryId ?? item.categoryId)
      : item.categoryId;
    const finalDate = updates.date !== undefined
      ? (updates.date ?? item.date ?? new Date().toISOString())
      : (item.date ?? new Date().toISOString());

    // SAFETY CHECK: These should never be null/undefined here
    // because readiness calculator ensures they're present
    if (!accountId || !categoryId) {
      toast.error('Account and category are required');
      return;
    }

    // Get selected account for currency check
    const selectedAccount = accountsData.find(a => a.id === accountId);
    const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== item.currencyCode;
    const finalExchangeRate = updates.exchangeRate !== undefined
      ? (updates.exchangeRate ?? item.exchangeRate)
      : item.exchangeRate;

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
        accountId: accountId ?? '',
        categoryId: categoryId ?? '',
        finalDescription: finalDescription ?? '',
        finalAmountCents: finalDisplayAmount !== null ? displayAmountToCents(finalDisplayAmount) : 0,  // Convert dollars to integer cents
        finalDate,
        exchangeRate: finalExchangeRate,
        lastKnownVersion: item.version,
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

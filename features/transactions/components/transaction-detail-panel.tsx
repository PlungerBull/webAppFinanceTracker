'use client';

import { useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { TransactionDetailPanel as SharedPanel } from '@/components/shared/transaction-detail-panel';
import type { TransactionPanelData, SelectableAccount, SelectableCategory, EditedFields } from '@/components/shared/transaction-detail-panel';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useDeleteTransaction } from '../hooks/use-transactions';
import { useTransactionUpdate } from '../hooks/use-transaction-update';
import type { TransactionViewEntity } from '../domain';
import type { UpdateRouteInputDTO } from '../domain/types';
import type { AccountViewEntity } from '@/features/accounts/domain';
import type { LeafCategoryEntity } from '@/features/categories/domain';
import { displayAmountToCents } from '@/lib/utils/cents-parser';

interface TransactionDetailPanelProps {
  transaction: TransactionViewEntity | null;
  accountId: string | null;
  categories: LeafCategoryEntity[];
  accounts: AccountViewEntity[]; // Use AccountViewEntity from Repository Pattern
  /** Render variant: 'desktop' = right sidebar, 'mobile' = bottom sheet */
  variant?: 'desktop' | 'mobile';
  /** Callback when panel is closed (for mobile sheet) */
  onClose?: () => void;
}

export function TransactionDetailPanel({
  transaction,
  // accountId - intentionally not destructured (lookup via transaction.accountId)
  categories,
  accounts,
  variant = 'desktop',
  onClose,
}: TransactionDetailPanelProps) {
  const deleteMutation = useDeleteTransaction();

  /**
   * CTO MANDATE: Use TransactionRoutingService for all updates.
   * This enables automatic demotion (Ledger → Inbox) when required fields are removed.
   */
  const { update, isUpdating } = useTransactionUpdate({
    onSuccess: (result) => {
      if (result.demoted) {
        toast.success('Moved to Inbox (missing required fields)');
      } else {
        toast.success('Transaction updated');
      }
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });


  // Transform TransactionViewEntity to PanelData
  // CTO MANDATE: PanelData uses null semantics. No null → undefined conversions.
  const panelData: TransactionPanelData | null = useMemo(() => {
    if (!transaction) return null;

    return {
      id: transaction.id,
      description: transaction.description,
      displayAmount: transaction.amountCents / 100, // Convert integer cents to decimal
      currency: transaction.currencyOriginal,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      date: transaction.date,
      notes: transaction.notes,
      sourceText: null, // Explicitly null for ledger (required by TransactionPanelData)
      exchangeRate: transaction.exchangeRate,
      reconciliationId: transaction.reconciliationId,
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

  /**
   * Handle save via TransactionRoutingService
   *
   * CTO MANDATE: Uses Universal Decision Engine for updates.
   * - Same Sacred Rules as submitTransaction()
   * - Automatic demotion if required fields are removed
   * - Keeps Ledger Sacred and 100% complete
   *
   * Flow:
   * 1. Merge EditedFields with current transaction state
   * 2. Build UpdateRouteInputDTO with full merged state
   * 3. Call routingService.updateTransaction()
   * 4. Service determines if update-in-place or demotion
   */
  const handleSave = useCallback(
    async (updates: EditedFields) => {
      if (!transaction) return;

      // Merge edited fields with current transaction state
      // undefined = not edited (use current), null = cleared, value = new value
      const mergedAmountCents =
        updates.displayAmount !== undefined
          ? updates.displayAmount !== null
            ? displayAmountToCents(updates.displayAmount)
            : null
          : transaction.amountCents;

      const mergedDescription =
        updates.description !== undefined
          ? updates.description
          : transaction.description;

      const mergedAccountId =
        updates.accountId !== undefined
          ? updates.accountId
          : transaction.accountId;

      const mergedCategoryId =
        updates.categoryId !== undefined
          ? updates.categoryId
          : transaction.categoryId;

      // Date is required - if cleared (null), fall back to original transaction date
      const mergedDate =
        updates.date !== undefined && updates.date !== null
          ? updates.date
          : transaction.date;

      const mergedNotes =
        updates.notes !== undefined
          ? updates.notes
          : transaction.notes;

      const mergedExchangeRate =
        updates.exchangeRate !== undefined
          ? updates.exchangeRate
          : transaction.exchangeRate;

      // Build UpdateRouteInputDTO with full merged state
      const routeInput: UpdateRouteInputDTO = {
        id: transaction.id,
        version: transaction.version,
        sourceRoute: 'ledger', // This panel is for ledger transactions
        amountCents: mergedAmountCents,
        description: mergedDescription,
        accountId: mergedAccountId,
        categoryId: mergedCategoryId,
        date: mergedDate,
        notes: mergedNotes,
        exchangeRate: mergedExchangeRate,
      };

      await update(routeInput);
    },
    [transaction, update]
  );

  // Handle delete
  const handleDelete = async () => {
    if (!transaction) return;
    await deleteMutation.mutateAsync({ id: transaction.id, version: transaction.version });
  };

  // Handle close - calls onClose prop for mobile sheet
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Shared panel props
  const sharedPanelProps = {
    mode: 'transaction' as const,
    data: panelData!,
    accounts: selectableAccounts,
    categories: selectableCategories,
    onSave: handleSave,
    onDelete: handleDelete,
    onClose: handleClose,
    isLoading: isUpdating || deleteMutation.isPending,
  };

  // Mobile: Render as bottom sheet
  if (variant === 'mobile') {
    return (
      <Sheet open={!!panelData} onOpenChange={(open) => !open && handleClose()}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-2xl p-0"
          style={{ zIndex: 'var(--z-detail-sheet)' }}
        >
          {panelData && <SharedPanel {...sharedPanelProps} />}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Render as right sidebar
  if (!panelData) {
    return (
      <div className="w-[400px] bg-white border-l border-gray-200 flex items-center justify-center text-gray-500">
        <p className="text-sm">Select a transaction to view details</p>
      </div>
    );
  }

  return <SharedPanel {...sharedPanelProps} />;
}

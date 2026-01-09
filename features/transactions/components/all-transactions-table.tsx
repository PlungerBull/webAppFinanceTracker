'use client';

import { useState, useMemo, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';
import { BulkActionBar } from '@/features/transactions/components/bulk-action-bar';
import { useGroupingChildren } from '@/features/groupings/hooks/use-groupings';
import { useTransactions, useCategoryCounts, useBulkUpdateTransactions } from '../hooks/use-transactions';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { useUserSettings, useUpdateSortPreference } from '@/features/settings/hooks/use-user-settings';
import { useTransactionSelection } from '@/stores/transaction-selection-store';
import { useLinkTransactions, useUnlinkTransactions } from '@/features/reconciliations/hooks/use-reconciliations';
import { toast } from 'sonner';
import type { TransactionRow } from '../types';
import type { TransactionSortMode } from '@/types/domain';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const categoryId = searchParams.get('categoryId');
  const groupingId = searchParams.get('grouping');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Bulk selection store
  const {
    selectedIds,
    isBulkMode,
    stagedUpdates,
    lastSelectedIndex,
    toggleSelection,
    selectRange,
    clearSelection,
    setStagedUpdate,
    clearStagedUpdates,
    enterBulkMode,
    exitBulkMode,
    hasSelection,
    canApply,
  } = useTransactionSelection();

  // Fetch user settings for sort preference
  const { data: userSettings, isLoading: isLoadingSettings } = useUserSettings();
  const updateSortPreference = useUpdateSortPreference();

  // Local sort state (synced with user settings)
  const [sortBy, setSortBy] = useState<TransactionSortMode>(
    userSettings?.transactionSortPreference || 'date'
  );

  // Sync local state when settings load/change
  useEffect(() => {
    if (userSettings?.transactionSortPreference) {
      setSortBy(userSettings.transactionSortPreference);
    }
  }, [userSettings?.transactionSortPreference]);

  // Handle sort toggle with persistence
  const handleSortChange = (newSortBy: TransactionSortMode) => {
    setSortBy(newSortBy); // Immediate UI update
    updateSortPreference.mutate(newSortBy); // Persist to database
  };

  // Fetch children if grouping is selected
  const { data: groupingChildren = [] } = useGroupingChildren(groupingId || '');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Bulk update mutation
  const bulkUpdateMutation = useBulkUpdateTransactions();

  // Reconciliation mutations
  const linkTransactionsMutation = useLinkTransactions();
  const unlinkTransactionsMutation = useUnlinkTransactions();

  // Build category filter for grouping
  const categoryFilter = useMemo(() => {
    if (groupingId && groupingChildren.length > 0) {
      return groupingChildren.map(c => c.id);
    }
    return undefined;
  }, [groupingId, groupingChildren]);

  // Build active category filter by merging grouping and user selection
  const activeCategoryIds = useMemo(() => {
    // If user has manually selected categories, use ONLY those (they are specific)
    if (selectedCategories.length > 0) {
      return selectedCategories;
    }
    // Otherwise, fallback to the grouping filter (if any)
    return categoryFilter;
  }, [selectedCategories, categoryFilter]);

  // Use API layer hooks instead of direct database calls (infinite query for virtualization)
  const {
    data: transactions,
    isLoading: isLoadingTransactions,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    totalCount,
  } = useTransactions({
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    categoryIds: activeCategoryIds,
    // Server-side filtering
    searchQuery: searchQuery || undefined,
    date: selectedDate,
    sortBy, // Pass current sort mode
  });

  const categories = useLeafCategories();
  const { data: accountsData = [] } = useGroupedAccounts(); // Still needed for sidebar
  const { data: flatAccounts = [] } = useAccounts(); // Flat accounts with currencySymbol for detail panel

  // Get server-side category counts (accurate even with pagination)
  const { data: categoryCounts = {} } = useCategoryCounts({
    accountId: accountId || undefined,
    categoryIds: activeCategoryIds,
    searchQuery: searchQuery || undefined,
    date: selectedDate,
    sortBy, // Pass for cache separation
  });

  const isLoading = isLoadingTransactions || isLoadingSettings;

  // Use grouped accounts directly (each group represents an account)
  const accounts = accountsData;

  // Determine display names
  const accountName = accountId ? flatAccounts.find(a => a.accountId === accountId)?.name : null;
  const categoryName = categoryId ? categories.find(c => c.id === categoryId)?.name : null;
  const groupingName = groupingId && groupingChildren.length > 0 ? groupingChildren[0]?.name : null;

  // No client-side filtering needed anymore - API handles it all
  const filteredTransactions = transactions;

  // Determine the title for the transaction list
  const pageTitle = groupingName || categoryName || accountName || 'Transactions';

  const selectedTransaction = selectedTransactionId
    ? transactions.find((t: TransactionRow) => t.id === selectedTransactionId) || null
    : null;

  // Clear selections when filters change
  useEffect(() => {
    if (isBulkMode && hasSelection()) {
      clearSelection();
    }
  }, [searchQuery, selectedDate, selectedCategories, sortBy]);

  // Handle bulk mode toggle
  const handleToggleBulkMode = () => {
    if (isBulkMode) {
      exitBulkMode();
    } else {
      enterBulkMode();
    }
  };

  // Handle selection toggle with Shift+Click, Cmd/Ctrl+Click, and normal click support
  const handleToggleSelection = (id: string, index: number, event: React.MouseEvent) => {
    const allTransactionIds = transactions.map(t => t.id);
    const hasModifierKey = event.shiftKey || event.metaKey || event.ctrlKey;

    if (event.shiftKey && lastSelectedIndex !== null) {
      // Shift+Click: Range selection from last selected to current
      selectRange(lastSelectedIndex, index, allTransactionIds);
    } else if (hasModifierKey) {
      // Cmd/Ctrl+Click: Toggle individual item (additive selection)
      toggleSelection(id, index);
    } else {
      // Normal Click: RESET behavior
      // Clear all selections, focus this item, start new selection set with only this item
      clearSelection();
      toggleSelection(id, index);
      setSelectedTransactionId(id);
    }
  };

  // Handle bulk apply
  const handleBulkApply = async () => {
    if (!canApply()) {
      toast.error('Please select transactions and specify at least one field to update');
      return;
    }

    // Show warning for large selections
    if (selectedIds.size >= 50) {
      toast.info(`Processing ${selectedIds.size} transactions. This may take a moment...`);
    }

    try {
      // Handle reconciliation linking/unlinking separately if reconciliationId is in stagedUpdates
      if ('reconciliationId' in stagedUpdates) {
        const reconciliationId = stagedUpdates.reconciliationId;

        if (reconciliationId === undefined) {
          // Unlink transactions
          await unlinkTransactionsMutation.mutateAsync(Array.from(selectedIds));
        } else if (reconciliationId) {
          // Link transactions to reconciliation
          await linkTransactionsMutation.mutateAsync({
            reconciliationId,
            transactionIds: Array.from(selectedIds),
          });
        }

        // Clear selections and staged updates after successful operation
        clearSelection();
        clearStagedUpdates();
        return;
      }

      // Standard bulk update for other fields
      const result = await bulkUpdateMutation.mutateAsync({
        ids: Array.from(selectedIds),
        updates: stagedUpdates,
      });

      // Show feedback
      if (result.errorCount > 0) {
        toast.error(
          `Updated ${result.successCount} transactions, ${result.errorCount} failed. Check console for details.`,
          { duration: 5000 }
        );
        console.error('Bulk update errors:', result.errors);
      } else {
        toast.success(`Successfully updated ${result.successCount} transactions`);
      }

      // Clear selections and staged updates after successful operation
      clearSelection();
      clearStagedUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update transactions');
    }
  };


  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Transactions List (Virtualized with Infinite Scroll) */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        selectedTransactionId={selectedTransactionId}
        onTransactionSelect={setSelectedTransactionId}
        title={pageTitle}
        totalCount={totalCount}
        // Filter props
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        selectedCategories={selectedCategories}
        onCategoryChange={setSelectedCategories}
        categories={categories}
        categoryCounts={categoryCounts}
        // Sort props
        sortBy={sortBy}
        onSortChange={handleSortChange}
        // Bulk selection props
        isBulkMode={isBulkMode}
        selectedIds={selectedIds}
        onToggleBulkMode={handleToggleBulkMode}
        onToggleSelection={handleToggleSelection}
      />

      {/* Section 3: Transaction Details Panel */}
      <TransactionDetailPanel
        transaction={selectedTransaction}
        accountId={accountId}
        categories={categories}
        accounts={flatAccounts}
      />

      {/* Bulk Action Bar - show only in bulk mode when selections exist */}
      {isBulkMode && hasSelection() && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          onApply={handleBulkApply}
          isApplying={
            bulkUpdateMutation.isPending ||
            linkTransactionsMutation.isPending ||
            unlinkTransactionsMutation.isPending
          }
          canApply={canApply()}
          categoryValue={stagedUpdates.categoryId}
          onCategoryChange={(value) => setStagedUpdate('categoryId', value)}
          accountValue={stagedUpdates.accountId}
          onAccountChange={(value) => setStagedUpdate('accountId', value)}
          dateValue={stagedUpdates.date}
          onDateChange={(value) => setStagedUpdate('date', value)}
          notesValue={stagedUpdates.notes}
          onNotesChange={(value) => setStagedUpdate('notes', value)}
          reconciliationValue={stagedUpdates.reconciliationId}
          onReconciliationChange={(value) => setStagedUpdate('reconciliationId', value)}
        />
      )}
    </div>
  );
}

export function AllTransactionsTable() {
  return (
    <SidebarProvider>
      <TransactionsContent />
    </SidebarProvider>
  );
}

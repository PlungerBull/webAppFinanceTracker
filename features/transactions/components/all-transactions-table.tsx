'use client';

/**
 * AllTransactionsTable Component (Orchestrator)
 *
 * Orchestration component that composes domain hooks and UI components.
 * After refactoring: ~160 lines of composition logic.
 *
 * CTO MANDATES IMPLEMENTED:
 * 1. Domain Hooks as Controllers - useBulkSelection, useTransactionFilters
 * 2. Side Effects as Callbacks - Toast calls passed to hooks
 * 3. Composition Pattern - FilterBar and TransactionList as siblings
 * 4. Dumb Components - TransactionList has no filter UI
 *
 * @module all-transactions-table
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/components/shared/transaction-list';
import { TransactionFilterBar } from '@/features/transactions/components/transaction-filter-bar';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';
import { BulkActionBar } from '@/features/transactions/components/bulk-action-bar';
import { useTransactions, useCategoryCounts } from '../hooks/use-transactions';
import { useBulkSelection } from '@/lib/hooks/use-bulk-selection';
import { useTransactionFilters } from '../hooks/use-transaction-filters';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useGroupedAccounts } from '@/lib/hooks/use-grouped-accounts';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import { useUserSettings, useUpdateSortPreference } from '@/features/settings/hooks/use-user-settings';
import { useIsMobile } from '@/lib/hooks/use-is-mobile';
import { toast } from 'sonner';
import type { TransactionViewEntity } from '../domain';
import type { TransactionSortMode } from '@/types/domain';

function TransactionsContent() {
  // === URL State (Orchestrator responsibility) ===
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const categoryId = searchParams.get('categoryId');
  const groupingId = searchParams.get('grouping');

  // === Detail Panel State ===
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // === Sort Preference ===
  const { data: userSettings, isLoading: isLoadingSettings } = useUserSettings();
  const updateSortPreference = useUpdateSortPreference();

  const [sortBy, setSortBy] = useState<TransactionSortMode>(
    userSettings?.transactionSortPreference || 'date'
  );

  // Sync local state when settings load/change
  useEffect(() => {
    if (userSettings?.transactionSortPreference) {
      setSortBy(userSettings.transactionSortPreference);
    }
  }, [userSettings?.transactionSortPreference]);

  const handleSortChange = (newSortBy: TransactionSortMode) => {
    setSortBy(newSortBy);
    updateSortPreference.mutate(newSortBy);
  };

  // === Filters (Domain Hook) ===
  const filters = useTransactionFilters({ groupingId });

  // === Queries ===
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
    categoryIds: filters.activeCategoryIds,
    searchQuery: filters.searchQuery || undefined,
    date: filters.selectedDate,
    sortBy,
  });

  const categories = useLeafCategories();
  const { data: accountsData = [] } = useGroupedAccounts();
  const { data: flatAccounts = [] } = useAccounts();

  const { data: categoryCounts = {} } = useCategoryCounts({
    accountId: accountId || undefined,
    categoryIds: filters.activeCategoryIds,
    searchQuery: filters.searchQuery || undefined,
    date: filters.selectedDate,
    sortBy,
  });

  const isLoading = isLoadingTransactions || isLoadingSettings;

  // === Mobile Detection ===
  const isMobile = useIsMobile();

  // === Bulk Selection (Domain Hook) ===
  // Pass filterKey for stable dependency tracking (no JSON.stringify)
  const bulk = useBulkSelection({
    transactions,
    onFocusTransaction: setSelectedTransactionId,
    filterKey: filters.filterKey,
  });

  // === Side Effect Callbacks (Passed to domain hook) ===
  const handleBulkApply = () =>
    bulk.handleBulkApply({
      onSuccess: (result) => {
        if (result.failureCount > 0) {
          toast.error(
            `Updated ${result.successCount} transactions, ${result.failureCount} failed.`,
            { duration: 5000 }
          );
        } else {
          toast.success(`Successfully updated ${result.successCount} transactions`);
        }
      },
      onError: (err) => toast.error(err.message),
      onLargeSelection: (count) =>
        toast.info(`Processing ${count} transactions. This may take a moment...`),
    });

  // === Derived State ===
  const accountName = accountId ? flatAccounts.find((a) => a.id === accountId)?.name : null;
  const categoryName = categoryId ? categories.find((c) => c.id === categoryId)?.name : null;
  const groupingName =
    groupingId && filters.groupingChildren.length > 0 ? filters.groupingChildren[0]?.name : null;

  const pageTitle = groupingName || categoryName || accountName || 'Transactions';

  const selectedTransaction = selectedTransactionId
    ? transactions.find((t: TransactionViewEntity) => t.id === selectedTransactionId) || null
    : null;

  // === Panel Close Handler ===
  const handleDetailPanelClose = useCallback(() => {
    setSelectedTransactionId(null);
  }, []);

  // === Render (Composition Pattern) ===
  // FilterBar and TransactionList are siblings, not parent-child
  return (
    <div className="flex flex-col md:flex-row h-dvh overflow-hidden bg-white dark:bg-zinc-900">
      {/* Mobile Header - only visible on mobile */}
      <MobileHeader />

      {/* Sidebar - handles its own responsive behavior */}
      <Sidebar />

      {/* Main Content: Filter Bar + Transaction List (siblings) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter Bar - Pure component, rendered as sibling */}
        <TransactionFilterBar
          title={pageTitle}
          totalCount={totalCount}
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          selectedDate={filters.selectedDate}
          onDateChange={filters.setSelectedDate}
          selectedCategories={filters.selectedCategories}
          onCategoryChange={filters.setSelectedCategories}
          categories={categories}
          categoryCounts={categoryCounts}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          isBulkMode={bulk.isBulkMode}
          onToggleBulkMode={bulk.handleToggleBulkMode}
          onClearFilters={filters.clearAllFilters}
        />

        {/* Transaction List - Dumb virtualizer, no filter UI */}
        <TransactionList
          transactions={transactions}
          isLoading={isLoading}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          fetchNextPage={fetchNextPage}
          selectedTransactionId={selectedTransactionId}
          onTransactionSelect={setSelectedTransactionId}
          isBulkMode={bulk.isBulkMode}
          selectedIds={bulk.selectedIds}
          onToggleBulkMode={bulk.handleToggleBulkMode}
          onToggleSelection={bulk.handleToggleSelection}
          onEnterBulkMode={bulk.enterBulkMode}
        />
      </div>

      {/* Transaction Details Panel - Desktop: right sidebar, Mobile: bottom sheet */}
      {isMobile ? (
        <TransactionDetailPanel
          transaction={selectedTransaction}
          accountId={accountId}
          categories={categories}
          accounts={flatAccounts}
          variant="mobile"
          onClose={handleDetailPanelClose}
        />
      ) : (
        <TransactionDetailPanel
          transaction={selectedTransaction}
          accountId={accountId}
          categories={categories}
          accounts={flatAccounts}
          variant="desktop"
        />
      )}

      {/* Bulk Action Bar - Conditionally rendered */}
      {bulk.isBulkMode && bulk.hasSelection && (
        <BulkActionBar
          selectedCount={bulk.selectedIds.size}
          onClearSelection={bulk.clearSelection}
          onApply={handleBulkApply}
          isApplying={bulk.isPendingSync}
          canApply={bulk.canApply}
          categoryValue={bulk.stagedUpdates.categoryId}
          onCategoryChange={(value) => bulk.setStagedUpdate('categoryId', value)}
          accountValue={bulk.stagedUpdates.accountId}
          onAccountChange={(value) => bulk.setStagedUpdate('accountId', value)}
          dateValue={bulk.stagedUpdates.date}
          onDateChange={(value) => bulk.setStagedUpdate('date', value)}
          notesValue={bulk.stagedUpdates.notes}
          onNotesChange={(value) => bulk.setStagedUpdate('notes', value)}
          reconciliationValue={bulk.stagedUpdates.reconciliationId}
          onReconciliationChange={(value) => bulk.setStagedUpdate('reconciliationId', value)}
          selectedIds={bulk.selectedIds}
          transactions={transactions}
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

'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';
import { useGroupingChildren } from '@/features/groupings/hooks/use-groupings';
import { useTransactions, useCategoryCounts } from '../hooks/use-transactions';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { useAccounts } from '@/features/accounts/hooks/use-accounts';
import type { TransactionRow } from '../types';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const categoryId = searchParams.get('categoryId');
  const groupingId = searchParams.get('grouping');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Fetch children if grouping is selected
  const { data: groupingChildren = [] } = useGroupingChildren(groupingId || '');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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
  });

  const isLoading = isLoadingTransactions;

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
      />

      {/* Section 3: Transaction Details Panel */}
      <TransactionDetailPanel
        transaction={selectedTransaction}
        accountId={accountId}
        categories={categories}
        accounts={flatAccounts}
      />
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

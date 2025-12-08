'use client';

import { useState, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';
import { useGroupingChildren } from '@/features/groupings/hooks/use-groupings';
import { useTransactions } from '../hooks/use-transactions';
import { useCategories } from '@/features/categories/hooks/use-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
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

  // Use API layer hooks instead of direct database calls
  const { data: transactions = [], isLoading: isLoadingTransactions } = useTransactions({
    accountId: accountId || undefined,
    categoryId: categoryId || undefined,
    categoryIds: activeCategoryIds,
    // Server-side filtering
    searchQuery: searchQuery || undefined,
    date: selectedDate,
  });

  const { data: categories = [] } = useCategories();
  const { data: accountsData = [] } = useGroupedAccounts();

  const isLoading = isLoadingTransactions;

  // Use grouped accounts directly (each group represents an account)
  const accounts = accountsData;

  // Flatten accounts for the detail panel
  const flatAccounts = useMemo(() =>
    accountsData.map(group => ({
      id: group.accountId,
      name: group.name,
    })),
    [accountsData]
  );

  // Determine display names
  const accountName = accountId ? accounts.find(a => a.accountId === accountId)?.name : null;
  const categoryName = categoryId ? categories.find(c => c.id === categoryId)?.name : null;
  const groupingName = groupingId && groupingChildren.length > 0 ? groupingChildren[0]?.name : null;

  // No client-side filtering needed anymore - API handles it all
  const filteredTransactions = transactions;

  // Calculate transaction counts per category
  // Since we are filtering on server, these counts will reflect the *filtered* set
  const categoryCounts = categories.reduce((acc: Record<string, number>, category) => {
    acc[category.id] = filteredTransactions.filter((t: TransactionRow) => t.categoryId === category.id).length;
    return acc;
  }, {});

  // Determine the title for the transaction list
  const pageTitle = groupingName || categoryName || accountName || 'Transactions';

  const selectedTransaction = selectedTransactionId
    ? transactions.find((t: TransactionRow) => t.id === selectedTransactionId) || null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Transactions List */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        selectedTransactionId={selectedTransactionId}
        onTransactionSelect={setSelectedTransactionId}
        title={pageTitle}
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

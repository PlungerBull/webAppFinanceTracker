'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';
import { useGroupingChildren } from '@/features/groupings/hooks/use-groupings';

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
    return null;
  }, [groupingId, groupingChildren]);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'all', accountId, categoryId, groupingId, categoryFilter],
    queryFn: async () => {
      const supabase = createClient();

      // Query the enriched view (includes pre-joined category and account data)
      let query = supabase
        .from('transactions_view')
        .select('*');

      // Apply account filter if accountId is present
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      // Apply category filter if categoryId is present
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Apply grouping filter if groupingId is present (filter by all child categories)
      if (groupingId && categoryFilter && categoryFilter.length > 0) {
        query = query.in('category_id', categoryFilter);
      }

      const { data: transactions, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      // Fetch categories, accounts, and groupings for sidebar filters and metadata
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, color, parent_id');

      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, name');

      const { data: groupings } = await supabase
        .from('parent_categories_with_counts')
        .select('id, name');

      // Map transactions to match the expected TransactionRow interface
      const mappedTransactions = transactions?.map(t => ({
        id: t.id,
        date: t.date,
        description: t.description || '',
        category_name: t.category_name,
        category_color: t.category_color,
        category_id: t.category_id,
        amount_original: t.amount_original,
        currency_original: t.currency_original,
        account_name: t.account_name,
        account_id: t.account_id,
        exchange_rate: t.exchange_rate !== 1 ? t.exchange_rate : null,
        notes: t.notes,
      } as const)) || [];

      return {
        transactions: mappedTransactions as any,
        categories: categories || [],
        accounts: accounts || [],
        accountName: accountId && accounts?.length ? accounts.find(a => a.id === accountId)?.name : null,
        categoryName: categoryId && categories?.length ? categories.find(c => c.id === categoryId)?.name : null,
        groupingName: groupingId && groupings?.length ? groupings.find(g => g.id === groupingId)?.name : null,
      };
    },
  });

  const transactions = data?.transactions || [];
  const categories = data?.categories || [];
  const accounts = data?.accounts || [];
  const accountName = data?.accountName;
  const categoryName = data?.categoryName;
  const groupingName = data?.groupingName;

  // Apply client-side filters
  const filteredTransactions = transactions.filter((t: any) => {
    // Search filter
    if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Date filter
    if (selectedDate) {
      const transactionDate = new Date(t.date);
      // Compare year, month, and day
      if (
        transactionDate.getFullYear() !== selectedDate.getFullYear() ||
        transactionDate.getMonth() !== selectedDate.getMonth() ||
        transactionDate.getDate() !== selectedDate.getDate()
      ) {
        return false;
      }
    }

    // Category filter - check if transaction's category is in selected categories array
    if (selectedCategories.length > 0 && !selectedCategories.includes(t.category_id)) {
      return false;
    }

    return true;
  });

  // Calculate transaction counts per category for the filter dropdown
  const categoryCounts = categories.reduce((acc: Record<string, number>, category) => {
    acc[category.id] = filteredTransactions.filter((t: any) => t.category_id === category.id).length;
    return acc;
  }, {});

  // Determine the title for the transaction list
  const pageTitle = groupingName || categoryName || accountName || 'Transactions';

  const selectedTransaction = selectedTransactionId
    ? transactions.find((t: any) => t.id === selectedTransactionId) || null
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
        categories={categories}
        accounts={accounts}
        accountId={accountId}
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

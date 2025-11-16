'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';
import { SidebarProvider } from '@/contexts/sidebar-context';
import { TransactionList } from '@/features/transactions/components/transaction-list';
import { TransactionDetailPanel } from '@/features/transactions/components/transaction-detail-panel';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'all', accountId],
    queryFn: async () => {
      const supabase = createClient();

      // Build query with optional account filter (RLS handles user filtering)
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          description,
          amount_original,
          currency_original,
          exchange_rate,
          category_id,
          account_id,
          notes
        `);

      // Apply account filter if accountId is present
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data: transactionsData, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      if (!transactionsData) return { transactions: [], accountName: null };

      // Fetch categories (RLS handles user filtering)
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, icon');

      // Fetch account names (RLS handles user filtering)
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, name');

      // Create lookup maps
      const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);
      const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);

      // Enrich transactions with category and account data
      const enrichedData = transactionsData.map(transaction => {
        const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null;
        const account = accountMap.get(transaction.account_id);

        return {
          id: transaction.id,
          date: transaction.date,
          description: transaction.description || '',
          category_name: category?.name || null,
          category_icon: category?.icon || null,
          category_id: transaction.category_id,
          amount_original: transaction.amount_original,
          currency_original: transaction.currency_original,
          account_name: account?.name || 'Unknown',
          account_id: transaction.account_id,
          exchange_rate: transaction.exchange_rate !== 1 ? transaction.exchange_rate : null,
          notes: transaction.notes,
        };
      });

      return {
        transactions: enrichedData,
        categories: categories || [],
        accounts: accounts || [],
        accountName: accountId && accounts?.length ? accounts.find(a => a.id === accountId)?.name : null,
      };
    },
  });

  const transactions = data?.transactions || [];
  const categories = data?.categories || [];
  const accounts = data?.accounts || [];
  const accountName = data?.accountName;

  const selectedTransaction = selectedTransactionId
    ? transactions.find(t => t.id === selectedTransactionId) || null
    : null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Transactions List */}
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        selectedTransactionId={selectedTransactionId}
        onTransactionSelect={setSelectedTransactionId}
        accountName={accountName}
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

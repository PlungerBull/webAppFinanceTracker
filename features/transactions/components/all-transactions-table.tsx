'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { useSearchParams } from 'next/navigation';

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category_name: string | null;
  category_icon: string | null;
  amount_original: number;
  currency_original: string;
  account_name: string;
  exchange_rate: number | null;
}

export function AllTransactionsTable() {
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'all', accountId],
    queryFn: async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Build query with optional account filter
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
          account_id
        `)
        .eq('user_id', user.id);

      // Apply account filter if accountId is present
      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data: transactionsData, error } = await query.order('date', { ascending: false });

      if (error) throw error;
      if (!transactionsData) return { transactions: [], accountName: null };

      // Fetch categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, icon')
        .or(`user_id.eq.${user.id},user_id.is.null`);

      // Fetch account names
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, name')
        .eq('user_id', user.id);

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
          description: transaction.description,
          category_name: category?.name || null,
          category_icon: category?.icon || null,
          amount_original: transaction.amount_original,
          currency_original: transaction.currency_original,
          account_name: account?.name || 'Unknown',
          exchange_rate: transaction.exchange_rate !== 1 ? transaction.exchange_rate : null,
        };
      });

      return {
        transactions: enrichedData,
        accountName: accountId && accounts?.length ? accounts.find(a => a.id === accountId)?.name : null,
      };
    },
  });

  const transactions = data?.transactions || [];
  const accountName = data?.accountName;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      {/* Section 1: Sidebar */}
      <Sidebar />

      {/* Section 2: Transactions List */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {accountName || 'Transactions'}
          </h1>
        </div>

        {/* Transactions List */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-zinc-500 dark:text-zinc-400">
                No transactions found. Start adding transactions to see them here.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  onClick={() => setSelectedTransactionId(transaction.id)}
                  className={cn(
                    'px-6 py-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900',
                    selectedTransactionId === transaction.id && 'bg-zinc-100 dark:bg-zinc-900'
                  )}
                >
                  <div className="flex items-center justify-between">
                    {/* Left: Description */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50 truncate">
                        {transaction.description}
                      </p>
                    </div>

                    {/* Right: Amount and Date */}
                    <div className="flex items-center gap-6 ml-4">
                      <div className="text-right">
                        <p
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            transaction.amount_original >= 0
                              ? 'text-green-600 dark:text-green-500'
                              : 'text-red-600 dark:text-red-500'
                          )}
                        >
                          {formatCurrency(transaction.amount_original, transaction.currency_original)}
                        </p>
                      </div>
                      <div className="text-right w-24">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Transaction Details Panel */}
      <div className="w-96 bg-white dark:bg-zinc-950 overflow-y-auto">
        {selectedTransactionId ? (
          (() => {
            const transaction = transactions.find(t => t.id === selectedTransactionId);
            if (!transaction) return null;

            return (
              <div className="p-6">
                {/* Top: Description and Amount */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                    {transaction.description}
                  </h2>
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      transaction.amount_original >= 0
                        ? 'text-green-600 dark:text-green-500'
                        : 'text-red-600 dark:text-red-500'
                    )}
                  >
                    {formatCurrency(transaction.amount_original, transaction.currency_original)}
                  </p>
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  {/* Date */}
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                      Date
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">
                      {format(new Date(transaction.date), 'MMMM dd, yyyy')}
                    </p>
                  </div>

                  {/* Category */}
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                      Category
                    </p>
                    {transaction.category_name ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{transaction.category_icon}</span>
                        <span className="text-sm text-zinc-900 dark:text-zinc-50">
                          {transaction.category_name}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 dark:text-zinc-500">Uncategorized</p>
                    )}
                  </div>

                  {/* Bank Account */}
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                      Bank Account
                    </p>
                    <p className="text-sm text-zinc-900 dark:text-zinc-50">
                      {transaction.account_name}
                    </p>
                  </div>

                  {/* Exchange Rate - Only show if not 1 */}
                  {transaction.exchange_rate && transaction.exchange_rate !== 1 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">
                        Exchange Rate
                      </p>
                      <p className="text-sm text-zinc-900 dark:text-zinc-50">
                        {transaction.exchange_rate.toFixed(4)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        ) : (
          <div className="flex items-center justify-center h-full p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              Select a transaction to view details
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

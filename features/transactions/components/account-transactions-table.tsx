'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { TransactionList } from './transaction-list';

interface AccountTransactionsTableProps {
  accountId: string;
}

export function AccountTransactionsTable({ accountId }: AccountTransactionsTableProps) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'account', accountId],
    queryFn: async () => {
      const supabase = createClient();

      // Fetch transactions for this specific account (RLS handles user filtering)
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          date,
          description,
          amount_original,
          currency_original,
          exchange_rate,
          category_id,
          notes
        `)
        .eq('account_id', accountId)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Fetch categories (RLS handles user filtering)
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, color');

      // Fetch account name
      const { data: account } = await supabase
        .from('bank_accounts')
        .select('name')
        .eq('id', accountId)
        .single();

      // Create lookup map
      const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);

      // Enrich transactions with category data
      return data.map(transaction => {
        const category = transaction.category_id ? categoryMap.get(transaction.category_id) : null;

        return {
          id: transaction.id,
          date: transaction.date,
          description: transaction.description || '',
          category_name: category?.name || null,
          category_color: category?.color || null,
          category_id: transaction.category_id,
          amount_original: transaction.amount_original,
          currency_original: transaction.currency_original,
          account_name: account?.name || 'Unknown',
          account_id: accountId,
          exchange_rate: transaction.exchange_rate !== 1 ? transaction.exchange_rate : null,
          notes: transaction.notes,
        };
      });
    },
  });

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden h-[600px] flex flex-col">
      <TransactionList
        transactions={transactions}
        isLoading={isLoading}
        selectedTransactionId={null}
        variant="compact"
      />
    </div>
  );
}

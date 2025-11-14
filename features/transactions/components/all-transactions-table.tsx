'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

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
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch transactions with related data
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
          account_id
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!data) return [];

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
      return data.map(transaction => {
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
    },
  });

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          No transactions found. Start adding transactions to see them here.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Date</TableHead>
              <TableHead className="min-w-[200px]">Description</TableHead>
              <TableHead className="w-[150px]">Category</TableHead>
              <TableHead className="text-right w-[120px]">Amount</TableHead>
              <TableHead className="w-[80px]">Currency</TableHead>
              <TableHead className="w-[150px]">Account</TableHead>
              <TableHead className="text-right w-[100px]">Exchange Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell className="font-medium">
                  {format(new Date(transaction.date), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell>
                  {transaction.category_name ? (
                    <div className="flex items-center gap-2">
                      <span>{transaction.category_icon}</span>
                      <span>{transaction.category_name}</span>
                    </div>
                  ) : (
                    <span className="text-zinc-400 dark:text-zinc-500">Uncategorized</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className={transaction.amount_original >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>
                    {formatCurrency(transaction.amount_original, transaction.currency_original)}
                  </span>
                </TableCell>
                <TableCell className="font-medium">
                  {transaction.currency_original}
                </TableCell>
                <TableCell>{transaction.account_name}</TableCell>
                <TableCell className="text-right">
                  {transaction.exchange_rate ? (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {transaction.exchange_rate.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

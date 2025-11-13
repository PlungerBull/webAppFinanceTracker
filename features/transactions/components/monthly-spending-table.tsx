'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { format, subMonths, startOfMonth } from 'date-fns';
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

interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  monthlyAmounts: { [key: string]: number };
}

export function MonthlySpendingTable() {
  // Generate last 6 months
  const months = useMemo(() => {
    const monthsArray: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      monthsArray.push(subMonths(new Date(), i));
    }
    return monthsArray;
  }, []);

  // Fetch all data using React Query - this will auto-update when transactions change
  const { data: spendingData, isLoading: loading } = useQuery({
    queryKey: ['transactions', 'monthly-spending'],
    queryFn: async () => {
      const supabase = createClient();

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get main currency
      const { data: currencyData } = await supabase
        .from('currencies')
        .select('code')
        .eq('user_id', user.id)
        .eq('is_main', true)
        .single();

      const mainCurrency = currencyData?.code || 'USD';

      // Get all categories
      const { data: categories } = await supabase
        .from('categories')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('name', { ascending: true });

      if (!categories) return { data: [], mainCurrency };

      // Get transactions for the last 6 months
      const oldestMonth = startOfMonth(months[0]);
      const { data: transactions } = await supabase
        .from('transactions')
        .select('category_id, date, amount_home')
        .eq('user_id', user.id)
        .gte('date', format(oldestMonth, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (!transactions) return { data: [], mainCurrency };

      // Build spending data by category and month
      const spendingByCategory: { [categoryId: string]: CategorySpending } = {};

      categories.forEach((category) => {
        spendingByCategory[category.id] = {
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          monthlyAmounts: {},
        };
      });

      // Add "Uncategorized" for transactions without a category
      spendingByCategory['uncategorized'] = {
        categoryId: 'uncategorized',
        categoryName: 'Uncategorized',
        categoryIcon: '❓',
        monthlyAmounts: {},
      };

      transactions.forEach((transaction) => {
        const transactionDate = new Date(transaction.date);
        const monthKey = format(startOfMonth(transactionDate), 'yyyy-MM');
        const categoryId = transaction.category_id || 'uncategorized';

        if (!spendingByCategory[categoryId]) {
          return;
        }

        if (!spendingByCategory[categoryId].monthlyAmounts[monthKey]) {
          spendingByCategory[categoryId].monthlyAmounts[monthKey] = 0;
        }

        spendingByCategory[categoryId].monthlyAmounts[monthKey] += transaction.amount_home;
      });

      // Filter out categories with no spending
      const categoriesWithSpending = Object.values(spendingByCategory).filter(
        (category) => Object.keys(category.monthlyAmounts).length > 0
      );

      return { data: categoriesWithSpending, mainCurrency };
    },
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      </Card>
    );
  }

  const data = spendingData?.data || [];
  const mainCurrency = spendingData?.mainCurrency || 'USD';

  if (data.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          No transaction data available yet. Start adding transactions to see your spending patterns.
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
              <TableHead className="w-[200px] sticky left-0 bg-white dark:bg-zinc-950 z-10">
                Category
              </TableHead>
              {months.map((month) => (
                <TableHead key={month.toISOString()} className="text-right min-w-[120px]">
                  {format(month, 'MMM yyyy')}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((category) => (
              <TableRow key={category.categoryId}>
                <TableCell className="font-medium sticky left-0 bg-white dark:bg-zinc-950 z-10">
                  <div className="flex items-center gap-2">
                    <span>{category.categoryIcon}</span>
                    <span>{category.categoryName}</span>
                  </div>
                </TableCell>
                {months.map((month) => {
                  const monthKey = format(startOfMonth(month), 'yyyy-MM');
                  const amount = category.monthlyAmounts[monthKey] || 0;
                  return (
                    <TableCell key={month.toISOString()} className="text-right">
                      {amount !== 0 ? (
                        <span className={amount > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}>
                          {formatCurrency(amount, mainCurrency)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

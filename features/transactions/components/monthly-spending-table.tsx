'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { format, subMonths, startOfMonth } from 'date-fns';
import { formatCurrencyShort } from '@/hooks/use-formatted-balance';
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
  // Generate last 6 months for column headers
  const months = useMemo(() => {
    const monthsArray: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      monthsArray.push(subMonths(new Date(), i));
    }
    return monthsArray;
  }, []);

  // Fetch data using the new database function
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
        .maybeSingle();

      const mainCurrency = currencyData?.code || 'USD';

      // Call our new database function!
      const { data: rawData, error } = await supabase
        .rpc('get_monthly_spending_by_category', {
          p_user_id: user.id,
          p_months_back: 6,
        });

      if (error) {
        console.error('Error fetching monthly spending:', error);
        throw error;
      }

      if (!rawData || rawData.length === 0) {
        return { data: [], mainCurrency };
      }

      // Transform flat data into grouped format for display
      const spendingByCategory: { [categoryId: string]: CategorySpending } = {};

      rawData.forEach((row: any) => {
        const categoryId = row.category_id;
        
        if (!spendingByCategory[categoryId]) {
          spendingByCategory[categoryId] = {
            categoryId: row.category_id,
            categoryName: row.category_name,
            categoryIcon: row.category_icon,
            monthlyAmounts: {},
          };
        }

        spendingByCategory[categoryId].monthlyAmounts[row.month_key] = row.total_amount;
      });

      const categoriesWithSpending = Object.values(spendingByCategory);

      return { data: categoriesWithSpending, mainCurrency };
    },
  });

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
                          {formatCurrencyShort(amount, mainCurrency)}
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
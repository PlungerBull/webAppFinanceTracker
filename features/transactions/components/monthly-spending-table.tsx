'use client';

import { useMemo } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { useCurrency } from '@/contexts/currency-context';
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
import { useMonthlySpending } from '../hooks/use-monthly-spending';
import { UI } from '@/lib/constants';

export function MonthlySpendingTable() {
  // Use optimized currency formatting
  const { formatCurrencyShort } = useCurrency();

  // Generate last 6 months for column headers
  const months = useMemo(() => {
    const monthsArray: Date[] = [];
    for (let i = UI.MONTHS_DISPLAY.SPENDING_TABLE - 1; i >= 0; i--) {
      monthsArray.push(subMonths(new Date(), i));
    }
    return monthsArray;
  }, []);

  // Fetch data using custom hook
  const { data: spendingData, isLoading: loading } = useMonthlySpending(UI.MONTHS_DISPLAY.SPENDING_TABLE);

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
                          {formatCurrencyShort(amount)}
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
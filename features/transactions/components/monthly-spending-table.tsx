'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrencyShort } from '@/hooks/use-formatted-balance';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useMonthlySpending } from '../hooks/use-monthly-spending';
import { UI, TRANSACTIONS } from '@/lib/constants';
import { startOfMonth, subMonths } from 'date-fns';

export function MonthlySpendingTable() {
  // Use optimized currency formatting
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < UI.MONTHS_DISPLAY.SPENDING_TABLE; i++) {
      result.push(startOfMonth(subMonths(today, i)));
    }
    return result;
  }, []);

  // Fetch data using custom hook
  const { data: spendingData, isLoading } = useMonthlySpending(UI.MONTHS_DISPLAY.SPENDING_TABLE);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const data = spendingData?.data || [];

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {TRANSACTIONS.UI.MESSAGES.NO_TRANSACTIONS}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-none shadow-none">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] sticky left-0 bg-white dark:bg-zinc-950 z-10">
                {TRANSACTIONS.UI.LABELS.CATEGORY}
              </TableHead>
              {months.map((month) => (
                <TableHead key={month.toISOString()} className="text-right min-w-[120px]">
                  {month.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </TableHead>
              ))}
              <TableHead className="text-right font-bold min-w-[120px]">{TRANSACTIONS.UI.LABELS.TOTAL}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((category) => (
              <TableRow key={category.categoryId}>
                <TableCell className="font-medium sticky left-0 bg-white dark:bg-zinc-950 z-10">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: category.categoryColor }}
                    />
                    <span className="truncate max-w-[150px]" title={category.categoryName}>
                      {category.categoryName}
                    </span>
                  </div>
                </TableCell>
                {months.map((month) => {
                  const monthKey = month.toISOString().slice(0, 7); // YYYY-MM
                  const amount = category.monthlyAmounts[monthKey] || 0;
                  return (
                    <TableCell key={month.toISOString()} className="text-right">
                      {amount > 0 ? formatCurrencyShort(amount, 'USD') : '-'}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right font-bold">
                  {formatCurrencyShort(Object.values(category.monthlyAmounts).reduce((sum, amt) => sum + amt, 0), 'USD')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
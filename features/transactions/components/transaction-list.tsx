'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/hooks/use-formatted-balance';
import { useSidebar } from '@/contexts/sidebar-context';
import { PageHeader } from '@/components/layout/page-header';

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category_name: string | null;
  category_color: string | null;
  category_id: string | null;
  amount_original: number;
  currency_original: string;
  account_name: string;
  account_id: string;
  exchange_rate: number | null;
  notes: string | null;
}

interface TransactionListProps {
  transactions: TransactionRow[];
  isLoading: boolean;
  selectedTransactionId: string | null;
  onTransactionSelect: (id: string) => void;
  title?: string | null;
}

export function TransactionList({
  transactions,
  isLoading,
  selectedTransactionId,
  onTransactionSelect,
  title,
}: TransactionListProps) {
  const { isCollapsed } = useSidebar();

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: typeof transactions } = {};
    transactions.forEach((transaction) => {
      const dateKey = format(new Date(transaction.date), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <PageHeader title={title || 'Transactions'} sidebarCollapsed={isCollapsed} />

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
          <div>
            {groupedTransactions.map(([dateKey, dateTransactions]) => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className={cn(
                  'transition-all duration-300',
                  isCollapsed ? 'px-32' : 'px-12'
                )}>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 py-3">
                    {format(new Date(dateKey), 'EEEE dd, MMM yyyy')}
                  </h3>
                </div>

                {/* Transactions for this date */}
                <div className={cn(
                  'transition-all duration-300',
                  isCollapsed ? 'ml-32' : 'ml-12'
                )}>
                  {dateTransactions.map((transaction, index) => (
                    <div key={transaction.id} className="relative">
                      {/* Category color line */}
                      {transaction.category_color && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                          style={{ backgroundColor: transaction.category_color }}
                        />
                      )}
                      <div
                        onClick={() => onTransactionSelect(transaction.id)}
                        className={cn(
                          'py-4 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-300',
                          isCollapsed ? 'pl-8 pr-32' : 'pl-8 pr-12',
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

                          {/* Right: Amount */}
                          <div className="text-right ml-4">
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
                        </div>
                      </div>
                      <div className="border-t border-zinc-200 dark:border-zinc-800" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

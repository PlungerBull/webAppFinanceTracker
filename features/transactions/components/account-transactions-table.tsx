'use client';

import { TransactionList } from './transaction-list';
import { useTransactions } from '../hooks/use-transactions';

interface AccountTransactionsTableProps {
  accountId: string;
}

export function AccountTransactionsTable({ accountId }: AccountTransactionsTableProps) {
  // Use API layer hook instead of direct database calls
  const { data: transactions = [], isLoading } = useTransactions({
    accountId,
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

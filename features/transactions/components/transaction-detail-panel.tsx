'use client';

import { useTransactionEditor } from '@/hooks/use-transaction-editor';
import { TransactionHeader } from './transaction-header';
import { TransactionInfo } from './transaction-info';

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

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Account {
  id: string;
  name: string;
}

interface TransactionDetailPanelProps {
  transaction: TransactionRow | null;
  categories: Category[];
  accounts: Account[];
  accountId: string | null;
}

export function TransactionDetailPanel({
  transaction,
  categories,
  accounts,
  accountId,
}: TransactionDetailPanelProps) {
  const {
    editingField,
    editedValue,
    showDatePicker,
    setEditedValue,
    setShowDatePicker,
    startEdit,
    cancelEdit,
    saveEdit,
  } = useTransactionEditor(accountId);

  if (!transaction) {
    return (
      <div className="w-96 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500">
        Select a transaction to view details
      </div>
    );
  }

  return (
    <div className="w-96 bg-white dark:bg-zinc-950 overflow-y-auto flex flex-col">
      <div className="flex-1 p-6 overflow-y-auto">
        <TransactionHeader
          transaction={transaction}
          editingField={editingField}
          editedValue={editedValue}
          setEditedValue={setEditedValue}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveEdit={saveEdit}
        />

        <TransactionInfo
          transaction={transaction}
          categories={categories}
          accounts={accounts}
          editingField={editingField}
          editedValue={editedValue}
          showDatePicker={showDatePicker}
          setEditedValue={setEditedValue}
          setShowDatePicker={setShowDatePicker}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          saveEdit={saveEdit}
        />
      </div>
    </div>
  );
}

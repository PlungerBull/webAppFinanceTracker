'use client';

import { cn } from '@/lib/utils';

interface TransactionTypeTabsProps {
  value: 'transaction' | 'transfer';
  onChange: (value: 'transaction' | 'transfer') => void;
  disabled?: boolean;
}

export function TransactionTypeTabs({ value, onChange, disabled = false }: TransactionTypeTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-full">
      <button
        type="button"
        onClick={() => !disabled && onChange('transaction')}
        disabled={disabled}
        className={cn(
          "px-6 py-2 rounded-full text-sm font-semibold transition-all",
          value === 'transaction'
            ? "bg-white shadow-sm text-gray-900"
            : "bg-transparent text-gray-500 hover:text-gray-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        Transaction
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange('transfer')}
        disabled={disabled}
        className={cn(
          "px-6 py-2 rounded-full text-sm font-semibold transition-all",
          value === 'transfer'
            ? "bg-white shadow-sm text-gray-900"
            : "bg-transparent text-gray-500 hover:text-gray-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        Transfer
      </button>
    </div>
  );
}

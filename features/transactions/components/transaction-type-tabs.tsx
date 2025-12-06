'use client';

import { cn } from '@/lib/utils';

interface TransactionTypeTabsProps {
  value: 'transaction' | 'transfer';
  onChange: (value: 'transaction' | 'transfer') => void;
  disabled?: boolean;
}

export function TransactionTypeTabs({ value, onChange, disabled = false }: TransactionTypeTabsProps) {
  return (
    <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100/80 rounded-xl">
      <button
        type="button"
        onClick={() => !disabled && onChange('transaction')}
        disabled={disabled}
        className={cn(
          "py-2 px-4 rounded-lg text-sm font-medium transition-all",
          value === 'transaction'
            ? "bg-white shadow-sm text-gray-900"
            : "text-gray-600 hover:text-gray-900",
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
          "py-2 px-4 rounded-lg text-sm font-medium transition-all",
          value === 'transfer'
            ? "bg-white shadow-sm text-blue-600"
            : "text-gray-600 hover:text-gray-900",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        Transfer
      </button>
    </div>
  );
}

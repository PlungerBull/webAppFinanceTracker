'use client';

import { cn } from '@/lib/utils';
import type { PanelMode, EditedFields, PanelData, SelectableAccount } from './types';

interface IdentityHeaderProps {
  mode: PanelMode;
  data: PanelData;
  editedFields: EditedFields;
  onFieldChange: (field: keyof EditedFields, value: string | number | undefined) => void;
  categoryType?: 'income' | 'expense' | null;
  accounts: SelectableAccount[];
}

export function IdentityHeader({
  mode,
  data,
  editedFields,
  onFieldChange,
  categoryType,
  accounts,
}: IdentityHeaderProps) {
  // Determine amount color based on mode and category type
  const getAmountColor = () => {
    if (mode === 'inbox') return 'text-gray-900';
    if (categoryType === 'income') return 'text-green-600';
    if (categoryType === 'expense') return 'text-red-600';
    return 'text-gray-900';
  };

  const handleAmountChange = (value: string) => {
    // Allow empty string to clear back to undefined (draft state)
    if (value === '') {
      onFieldChange('amount', undefined); // Not 0!
      return;
    }

    // Allow decimal numbers with optional negative sign
    if (/^-?\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        onFieldChange('amount', numValue);
      } else if (value === '-') {
        // Allow typing just minus sign
        onFieldChange('amount', undefined);
      }
    }
  };

  // Derive currency from selected account (currency follows account selection)
  const selectedAccountId = editedFields.accountId ?? data.accountId;
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
  const displayCurrency = selectedAccount?.currencyCode;

  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100">
      {/* Context Label */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
        {mode === 'inbox' ? 'Incoming Transaction' : 'Transaction Details'}
      </p>

      {/* Editable Payee/Description */}
      <input
        type="text"
        value={editedFields.description ?? data.description ?? ''}
        onChange={(e) => onFieldChange('description', e.target.value)}
        className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0 mb-3"
        placeholder="No description"
      />

      {/* Editable Amount + Currency */}
      <div className="flex items-baseline gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={
            editedFields.amount !== undefined
              ? String(editedFields.amount)
              : data.amount !== undefined
              ? String(data.amount)
              : ''  // Empty string for controlled input (not undefined!)
          }
          onChange={(e) => handleAmountChange(e.target.value)}
          className={cn(
            'text-3xl font-mono font-bold tracking-tighter bg-transparent border-none outline-none focus:ring-0 p-0 transition-colors',
            getAmountColor()
          )}
          placeholder="--"
        />
        <span className="text-sm font-bold text-gray-400 uppercase">
          {displayCurrency || 'SELECT ACCOUNT'}
        </span>
      </div>
    </div>
  );
}

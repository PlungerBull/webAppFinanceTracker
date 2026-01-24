'use client';

import { cn } from '@/lib/utils';
import { useReconciliation } from '@/features/reconciliations/hooks/use-reconciliations';
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
  // Fetch reconciliation data to determine field locking
  const { data: reconciliation } = useReconciliation(data.reconciliationId ?? null);
  const isLocked = reconciliation?.status === 'completed';

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
      onFieldChange('displayAmount', undefined); // Not 0!
      return;
    }

    // Allow decimal numbers with optional negative sign
    if (/^-?\d*\.?\d*$/.test(value)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        onFieldChange('displayAmount', numValue);
      } else if (value === '-') {
        // Allow typing just minus sign
        onFieldChange('displayAmount', undefined);
      }
    }
  };

  // Dual-source currency resolution (handles race conditions and loading states):
  // 1. REACTIVE: Derive from selected account (supports real-time account changes)
  // 2. FALLBACK: Use transaction's own currency (survives loading states)
  // 3. DEFAULT: Clear prompt if both fail
  const selectedAccountId = editedFields.accountId ?? data.accountId;
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
  const displayCurrency =
    selectedAccount?.currencyCode ??  // Reactive lookup from accounts array
    data.currency ??                   // Fallback to transaction's currency
    'SELECT ACCOUNT';                  // Default prompt if both undefined

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
            editedFields.displayAmount !== undefined
              ? String(editedFields.displayAmount)
              : data.displayAmount !== undefined
              ? String(data.displayAmount)
              : ''  // Empty string for controlled input (not undefined!)
          }
          onChange={(e) => handleAmountChange(e.target.value)}
          disabled={isLocked}
          className={cn(
            'text-3xl font-mono font-bold tracking-tighter bg-transparent border-none outline-none focus:ring-0 p-0 transition-colors',
            getAmountColor(),
            isLocked && 'opacity-50 cursor-not-allowed'
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

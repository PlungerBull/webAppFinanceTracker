'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowDown } from 'lucide-react';
import { SmartSelector } from './smart-selector';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTransferResolution, type TransferResolutionOutput } from '../hooks/use-transfer-resolution';
import type { GroupedAccount } from '@/lib/hooks/use-grouped-accounts';
import type { AccountViewEntity } from '@/domain/accounts';

export interface TransferFormData {
  fromGroupId: string | null;
  toGroupId: string | null;
  fromAccountId: string | null;
  toAccountId: string | null;
  fromCurrency: string | null;
  toCurrency: string | null;
  sentAmount: string;
  receivedAmount: string;
  date: Date;
  notes: string;
}

interface TransferFormProps {
  data: TransferFormData;
  onChange: (data: Partial<TransferFormData>) => void;
  groupedAccounts: GroupedAccount[];
  rawAccounts: AccountViewEntity[];
  isSubmitting: boolean;
}

/**
 * TransferForm - Orchestrator Component
 *
 * CTO MANDATE: This component is a thin orchestrator that:
 * 1. Uses the pure useTransferResolution hook for all resolution logic
 * 2. Applies suggestions via a single visible useEffect
 * 3. Composes sub-components for rendering
 */
export function TransferForm({ data, onChange, groupedAccounts, rawAccounts }: TransferFormProps) {
  const resolution = useTransferResolution(data, groupedAccounts, rawAccounts);

  // CTO MANDATE: Single Visible Side-Effect to commit suggestions
  useEffect(() => {
    if (Object.keys(resolution.suggestions).length > 0) {
      onChange(resolution.suggestions);
    }
  }, [resolution.suggestions, onChange]);

  return (
    <div className="px-6 py-6 space-y-5 flex-1 overflow-y-auto">
      <div className="space-y-0 relative">
        <SourceCard data={data} onChange={onChange} resolution={resolution} groupedAccounts={groupedAccounts} />

        <div className="absolute left-1/2 -ml-4 top-[135px] z-30">
          <ConnectorArrow />
        </div>

        <DestinationCard data={data} onChange={onChange} resolution={resolution} groupedAccounts={groupedAccounts} />

        {resolution.isLoopTransfer && <LoopWarning />}

        <TransferFooter data={data} onChange={onChange} />
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS (Scannability Debt Paid) ---

interface CardProps {
  data: TransferFormData;
  onChange: (data: Partial<TransferFormData>) => void;
  resolution: TransferResolutionOutput;
  groupedAccounts: GroupedAccount[];
}

const SourceCard = ({ data, onChange, resolution, groupedAccounts }: CardProps) => (
  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 relative z-20">
    <div className="flex items-start justify-between mb-4">
      <AccountSelector
        label="Select source account"
        value={data.fromGroupId}
        onValueChange={(id) => onChange({ fromGroupId: id, fromAccountId: null, fromCurrency: null })}
        accounts={groupedAccounts}
        selectedAccount={resolution.selectedFromGroup}
      />
      <CurrencyToggle
        currencies={resolution.fromAccountCurrencies}
        selected={data.fromCurrency}
        onSelect={(c) => onChange({ fromCurrency: c })}
        isMulti={resolution.isFromAccountMultiCurrency}
      />
    </div>
    <AmountInput value={data.sentAmount} onChange={(val) => onChange({ sentAmount: val })} autoFocus />
  </div>
);

const DestinationCard = ({ data, onChange, resolution, groupedAccounts }: CardProps) => (
  <div
    className={cn(
      'rounded-2xl p-5 mt-[-10px] pt-8 relative z-10 transition-colors duration-300',
      !resolution.isSameCurrencyTransfer && data.toCurrency
        ? 'bg-blue-50/50 border border-blue-100'
        : 'bg-gray-50 border border-gray-100'
    )}
  >
    <div className="flex items-start justify-between mb-4">
      <AccountSelector
        label="Select destination account"
        value={data.toGroupId}
        onValueChange={(id) => onChange({ toGroupId: id, toAccountId: null, toCurrency: null })}
        accounts={groupedAccounts.filter((a) => a.groupId !== data.fromGroupId)}
        selectedAccount={resolution.selectedToGroup}
      />
      <CurrencyToggle
        currencies={resolution.toAccountCurrencies}
        selected={data.toCurrency}
        onSelect={(c) => onChange({ toCurrency: c })}
        isMulti={resolution.isToAccountMultiCurrency}
        dark
      />
    </div>
    <AmountLogic resolution={resolution} data={data} onChange={onChange} />
  </div>
);

// --- INTERNAL UI HELPERS ---

interface AccountSelectorProps {
  label: string;
  value: string | null;
  onValueChange: (groupId: string) => void;
  accounts: GroupedAccount[];
  selectedAccount: GroupedAccount | undefined;
}

const AccountSelector = ({ label, value, onValueChange, accounts, selectedAccount }: AccountSelectorProps) => (
  <Select value={value || ''} onValueChange={onValueChange}>
    <SelectTrigger className="border-0 bg-transparent p-0 h-auto hover:bg-transparent shadow-none w-auto gap-2">
      <SelectValue placeholder={label}>
        <span className={cn('text-lg font-semibold', !value && 'text-gray-400 font-normal')}>
          {selectedAccount?.name || label}
        </span>
      </SelectValue>
    </SelectTrigger>
    <SelectContent className="max-h-80">
      {accounts.map((account) => (
        <SelectItem key={account.groupId} value={account.groupId}>
          {account.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

interface CurrencyToggleProps {
  currencies: string[];
  selected: string | null;
  onSelect: (currency: string) => void;
  isMulti: boolean;
  dark?: boolean;
}

const CurrencyToggle = ({ currencies, selected, onSelect, isMulti, dark }: CurrencyToggleProps) => {
  if (isMulti) {
    return (
      <div className={cn('flex rounded-lg p-1 gap-1', dark ? 'bg-white/50 border border-black/5' : 'bg-gray-100')}>
        {currencies.map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => onSelect(currency)}
            className={cn(
              'px-2 py-0.5 rounded-md text-xs font-bold transition-all',
              selected === currency
                ? dark
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {currency}
          </button>
        ))}
      </div>
    );
  }

  // Single currency badge
  if (selected) {
    return (
      <div
        className={cn(
          'px-2 py-1 rounded-md text-xs font-bold text-gray-500',
          dark ? 'bg-white/50 border border-black/5' : 'bg-gray-100'
        )}
      >
        {selected}
      </div>
    );
  }

  return null;
};

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  colorClass?: string;
}

const AmountInput = ({
  value,
  onChange,
  autoFocus,
  placeholder = '0.00',
  colorClass = 'text-gray-900',
}: AmountInputProps) => (
  <div className="flex items-baseline gap-1">
    <span className="text-2xl font-light text-gray-300">$</span>
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        if (/^[+-]?\d*\.?\d*$/.test(val)) {
          onChange(val);
        }
      }}
      placeholder={placeholder}
      className={cn(
        'text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-gray-200',
        value ? colorClass : 'text-gray-300'
      )}
      autoFocus={autoFocus}
    />
  </div>
);

interface AmountLogicProps {
  resolution: TransferResolutionOutput;
  data: TransferFormData;
  onChange: (data: Partial<TransferFormData>) => void;
}

/**
 * AmountLogic - Encapsulates Mirror vs Unlock mode business rule
 * - Same currency: Destination mirrors source (read-only)
 * - Different currency: User enters received amount (editable)
 */
const AmountLogic = ({ resolution, data, onChange }: AmountLogicProps) => {
  const { isSameCurrencyTransfer } = resolution;

  return (
    <div className="flex items-baseline gap-1">
      <span
        className={cn(
          'text-2xl font-light transition-colors',
          !isSameCurrencyTransfer && data.toCurrency ? 'text-blue-300' : 'text-gray-300'
        )}
      >
        $
      </span>

      {isSameCurrencyTransfer ? (
        // MIRROR MODE: Read Only
        <span className={cn('text-4xl font-bold tabular-nums', data.sentAmount ? 'text-gray-400' : 'text-gray-300')}>
          {data.sentAmount || '0.00'}
        </span>
      ) : (
        // UNLOCK MODE: Editable
        <div className="relative w-full">
          <input
            type="text"
            inputMode="decimal"
            value={data.receivedAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*\.?\d*$/.test(val)) {
                onChange({ receivedAmount: val });
              }
            }}
            placeholder="0.00"
            className={cn(
              'text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-blue-200/50',
              data.receivedAmount ? 'text-blue-600' : 'text-blue-300'
            )}
          />
          {!data.receivedAmount && data.toCurrency && (
            <div className="absolute top-full left-0 mt-1 text-xs text-blue-500 font-medium animate-pulse">
              Unlocked: Enter exchanged amount
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ConnectorArrow = () => (
  <div className="bg-white p-1 rounded-full shadow-sm border border-gray-100">
    <div className="bg-gray-50 p-1.5 rounded-full">
      <ArrowDown className="w-4 h-4 text-gray-400" />
    </div>
  </div>
);

const LoopWarning = () => (
  <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg text-center font-medium">
    Cannot transfer to the same account with the same currency
  </div>
);

interface TransferFooterProps {
  data: TransferFormData;
  onChange: (data: Partial<TransferFormData>) => void;
}

const TransferFooter = ({ data, onChange }: TransferFooterProps) => (
  <div className="mt-4 flex items-center gap-3">
    <SmartSelector icon={CalendarIcon} label="Date" value={format(data.date, 'MMM d')}>
      <Calendar mode="single" selected={data.date} onSelect={(d) => d && onChange({ date: d })} initialFocus />
    </SmartSelector>
    <div className="flex-1">
      <Input
        placeholder="Add a note (optional)"
        value={data.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        className="h-11 text-sm bg-gray-50 border-gray-200 focus:bg-white focus:border-gray-300 rounded-xl"
      />
    </div>
  </div>
);

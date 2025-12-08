'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, ArrowDown } from 'lucide-react';
import { SmartSelector } from './smart-selector';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { GroupedAccount } from '@/hooks/use-grouped-accounts';

export interface TransferFormData {
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
  isSubmitting: boolean;
}

export function TransferForm({
  data,
  onChange,
  groupedAccounts,
  isSubmitting,
}: TransferFormProps) {
  const selectedFromAccount = groupedAccounts.find((a) => a.account_id === data.fromAccountId);
  const selectedToAccount = groupedAccounts.find((a) => a.account_id === data.toAccountId);

  // Check if accounts are multi-currency
  const fromAccountCurrencies = selectedFromAccount?.balances.map((b) => b.currency || 'USD') || [];
  const toAccountCurrencies = selectedToAccount?.balances.map((b) => b.currency || 'USD') || [];
  const isFromAccountMultiCurrency = fromAccountCurrencies.length > 1;
  const isToAccountMultiCurrency = toAccountCurrencies.length > 1;

  // Auto-select currency if only one available
  useEffect(() => {
    if (data.fromAccountId && fromAccountCurrencies.length === 1 && !data.fromCurrency) {
      onChange({ fromCurrency: fromAccountCurrencies[0] });
    }
  }, [data.fromAccountId, fromAccountCurrencies.length, data.fromCurrency]);

  useEffect(() => {
    if (data.toAccountId && toAccountCurrencies.length === 1 && !data.toCurrency) {
      onChange({ toCurrency: toAccountCurrencies[0] });
    }
  }, [data.toAccountId, toAccountCurrencies.length, data.toCurrency]);

  // Check if transfer currencies are the same
  const isSameCurrencyTransfer = data.fromCurrency === data.toCurrency;

  // Check if it's a loop transfer (same account + same currency)
  const isLoopTransfer = data.fromAccountId === data.toAccountId && data.fromCurrency === data.toCurrency;

  const handleFromAccountChange = (accountId: string) => {
    onChange({ fromAccountId: accountId, fromCurrency: null });
  };

  const handleToAccountChange = (accountId: string) => {
    onChange({ toAccountId: accountId, toCurrency: null });
  };

  return (
    <div className="px-6 py-6 space-y-5 flex-1 overflow-y-auto">
      <div className="space-y-0 relative">
        {/* SOURCE CARD (Top) */}
        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 relative z-20">
          <div className="flex items-start justify-between mb-4">
            {/* Account Selector */}
            <Select value={data.fromAccountId || ''} onValueChange={handleFromAccountChange}>
              <SelectTrigger className="border-0 bg-transparent p-0 h-auto hover:bg-transparent shadow-none w-auto gap-2">
                <SelectValue placeholder="Select source account">
                  <span className={cn("text-lg font-semibold", !data.fromAccountId && "text-gray-400 font-normal")}>
                    {selectedFromAccount?.name || 'Select source account'}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groupedAccounts
                  .filter((account) => account.is_visible)
                  .map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Currency Toggle (Pills) */}
            {isFromAccountMultiCurrency ? (
              <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
                {fromAccountCurrencies.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => onChange({ fromCurrency: currency })}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-bold transition-all",
                      data.fromCurrency === currency
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            ) : (
              data.fromCurrency && (
                <div className="bg-gray-100 px-2 py-1 rounded-md text-xs font-bold text-gray-500">
                  {data.fromCurrency}
                </div>
              )
            )}
          </div>

          {/* Amount Input */}
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-light text-gray-300">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={data.sentAmount}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[+-]?\d*\.?\d*$/.test(value)) {
                  onChange({ sentAmount: value });
                }
              }}
              placeholder="0.00"
              className={cn(
                "text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-gray-200",
                data.sentAmount ? "text-gray-900" : "text-gray-300"
              )}
              autoFocus
            />
          </div>
        </div>

        {/* CONNECTOR ARROW */}
        <div className="absolute left-1/2 -ml-4 top-[135px] z-30">
          <div className="bg-white p-1 rounded-full shadow-sm border border-gray-100">
            <div className="bg-gray-50 p-1.5 rounded-full">
              <ArrowDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* DESTINATION CARD (Bottom) */}
        <div className={cn(
          "rounded-2xl p-5 mt-[-10px] pt-8 relative z-10 transition-colors duration-300",
          !isSameCurrencyTransfer && data.toCurrency
            ? "bg-blue-50/50 border border-blue-100"
            : "bg-gray-50 border border-gray-100"
        )}>
          <div className="flex items-start justify-between mb-4">
            {/* Account Selector */}
            <Select value={data.toAccountId || ''} onValueChange={handleToAccountChange}>
              <SelectTrigger className="border-0 bg-transparent p-0 h-auto hover:bg-transparent shadow-none w-auto gap-2">
                <SelectValue placeholder="Select destination account">
                  <span className={cn("text-lg font-semibold", !data.toAccountId && "text-gray-400 font-normal")}>
                    {selectedToAccount?.name || 'Select destination account'}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-80">
                {groupedAccounts
                  .filter((account) => account.is_visible && account.account_id !== data.fromAccountId)
                  .map((account) => (
                    <SelectItem key={account.account_id} value={account.account_id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Currency Toggle (Pills) */}
            {isToAccountMultiCurrency ? (
              <div className="flex bg-white/50 border border-black/5 rounded-lg p-1 gap-1">
                {toAccountCurrencies.map((currency) => (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => onChange({ toCurrency: currency })}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-bold transition-all",
                      data.toCurrency === currency
                        ? "bg-gray-900 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            ) : (
              data.toCurrency && (
                <div className="bg-white/50 border border-black/5 px-2 py-1 rounded-md text-xs font-bold text-gray-500">
                  {data.toCurrency}
                </div>
              )
            )}
          </div>

          {/* Amount Logic */}
          <div className="flex items-baseline gap-1">
            <span className={cn(
              "text-2xl font-light transition-colors",
              !isSameCurrencyTransfer && data.toCurrency ? "text-blue-300" : "text-gray-300"
            )}>$</span>

            {isSameCurrencyTransfer ? (
              // MIRROR MODE: Read Only
              <span className={cn(
                "text-4xl font-bold tabular-nums",
                data.sentAmount ? "text-gray-400" : "text-gray-300"
              )}>
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
                    const value = e.target.value;
                    if (/^\d*\.?\d*$/.test(value)) {
                      onChange({ receivedAmount: value });
                    }
                  }}
                  placeholder="0.00"
                  className={cn(
                    "text-4xl font-bold bg-transparent border-0 outline-none p-0 w-full tabular-nums placeholder:text-blue-200/50",
                    data.receivedAmount ? "text-blue-600" : "text-blue-300"
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
        </div>

        {/* Loop Warning */}
        {isLoopTransfer && (
          <div className="text-xs text-red-500 bg-red-50 p-2 rounded-lg text-center font-medium">
            Cannot transfer to the same account with the same currency
          </div>
        )}

        {/* Footer: Date & Notes */}
        <div className="mt-4 flex items-center gap-3">
          <SmartSelector
            icon={CalendarIcon}
            label="Date"
            value={format(data.date, 'MMM d')}
          >
            <Calendar
              mode="single"
              selected={data.date}
              onSelect={(d) => d && onChange({ date: d })}
              initialFocus
            />
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
      </div>
    </div>
  );
}

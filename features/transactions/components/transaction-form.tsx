'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CreditCard, Tag, Calendar as CalendarIcon } from 'lucide-react';
import { SmartSelector } from './smart-selector';
import { CategorySelector } from './category-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Category } from '@/types/domain';
import type { AccountViewEntity } from '@/features/accounts/domain';

export interface TransactionFormData {
  amount: string;
  categoryId: string | null;
  fromAccountId: string | null; // Single source of truth
  exchangeRate: string;
  date: Date;
  payee: string;
  notes: string;
}

interface TransactionFormProps {
  data: TransactionFormData;
  onChange: (data: Partial<TransactionFormData>) => void;
  categories: Category[];
  flatAccounts: AccountViewEntity[]; // Use AccountViewEntity from Repository Pattern
  isSubmitting: boolean;
  hasSubmitted: boolean;
}

export function TransactionForm({
  data,
  onChange,
  categories,
  flatAccounts,
  isSubmitting,
  hasSubmitted,
}: TransactionFormProps) {
  const selectedAccount = flatAccounts.find((a) => a.id === data.fromAccountId);
  const selectedCategory = categories.find((c) => c.id === data.categoryId);

  const handleAccountChange = (accountId: string) => {
    onChange({ fromAccountId: accountId });
  };

  return (
    <div className="flex flex-col max-h-[90vh]">
      {/* ZONE 2: Hero Section - Amount */}
      <div className="relative py-6 px-6 shrink-0">
        <div className="flex items-center justify-center gap-3">
          <div className="relative flex justify-center">
            <span
              className={cn(
                "text-5xl tabular-nums transition-colors text-center",
                data.amount
                  ? cn(
                      "font-bold",
                      selectedCategory?.type === 'income' ? "text-green-600" :
                      selectedCategory?.type === 'expense' ? "text-red-600" :
                      "text-gray-900"
                    )
                  : "font-medium text-gray-300"
              )}
            >
              {data.amount || '0.00'}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={data.amount}
              onChange={(e) => {
                const value = e.target.value;
                if (/^[+-]?\d*\.?\d*$/.test(value)) {
                  onChange({ amount: value });
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text text-center"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* ZONE 3: Form Body */}
      <div className="px-6 py-6 space-y-5 flex-1 overflow-y-auto">
        {/* Payee */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Payee
          </Label>
          <Input
            placeholder="e.g. Starbucks, Uber, Rent"
            value={data.payee}
            onChange={(e) => onChange({ payee: e.target.value })}
            className="text-base bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-3"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Notes (Optional)
          </Label>
          <Input
            placeholder="Add notes..."
            value={data.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className="text-base bg-gray-50 border-transparent focus:bg-white focus:border-gray-200 rounded-xl px-4 py-3"
          />
        </div>
      </div>

      {/* ZONE 4: Footer - Control Center */}
      <div className="bg-white border-t border-gray-100 p-4 rounded-b-3xl shrink-0">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Account */}
            {/* CRITICAL: Always use currencyCode (not currencySymbol) for unambiguous display */}
            <SmartSelector
              icon={CreditCard}
              label="Account"
              value={selectedAccount ? `${selectedAccount.name} ${selectedAccount.currencyCode}` : undefined}
              placeholder="Account"
              required
              error={hasSubmitted && !data.fromAccountId}
            >
              <div className="w-72 max-h-96 overflow-y-auto p-2">
                {flatAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleAccountChange(account.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        data.fromAccountId === account.id
                          ? "bg-gray-100 text-gray-900 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      )}
                    >
                      <CreditCard
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: account.color || '#000' }}
                      />
                      <span className="flex-1 text-left">{account.name}</span>
                      <span className="text-gray-400 text-xs">{account.currencyCode}</span>
                    </button>
                  ))}
              </div>
            </SmartSelector>

            {/* Category */}
            <SmartSelector
              icon={Tag}
              label="Category"
              value={selectedCategory?.name || undefined}
              placeholder="Category"
              required
              error={hasSubmitted && !data.categoryId}
            >
              <CategorySelector
                value={data.categoryId || undefined}
                onChange={(value) => onChange({ categoryId: value })}
              />
            </SmartSelector>

            {/* Date */}
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
          </div>
        </div>

        {/* Exchange Rate Input - Only if different currency from home */}
        {selectedAccount && selectedAccount.currencyCode !== 'PEN' && (
          <div className="mb-3">
            <Input
              type="number"
              step="0.0001"
              placeholder={`Exchange rate (${selectedAccount.currencyCode} to PEN)`}
              value={data.exchangeRate}
              onChange={(e) => onChange({ exchangeRate: e.target.value })}
              className="text-sm bg-gray-50 border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}

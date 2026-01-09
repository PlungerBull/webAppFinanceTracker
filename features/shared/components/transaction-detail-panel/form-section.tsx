'use client';

import { Building2, Hash, Calendar as CalendarIcon, FileText, ArrowRightLeft, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCurrency } from '@/contexts/currency-context';
import { useReconciliation } from '@/features/reconciliations/hooks/use-reconciliations';
import type { PanelMode, EditedFields, PanelData, SelectableAccount, SelectableCategory } from './types';

interface FormSectionProps {
  mode: PanelMode;
  data: PanelData;
  editedFields: EditedFields;
  onFieldChange: (field: keyof EditedFields, value: string | number) => void;
  accounts: SelectableAccount[];
  categories: SelectableCategory[];
}

export function FormSection({
  mode,
  data,
  editedFields,
  onFieldChange,
  accounts,
  categories,
}: FormSectionProps) {
  // Access user's main currency
  const { mainCurrency } = useCurrency();

  // Fetch reconciliation data to determine field locking
  const { data: reconciliation } = useReconciliation(data.reconciliationId ?? null);
  const isLocked = reconciliation?.status === 'completed';

  const selectedAccountId = editedFields.accountId ?? data.accountId;
  const selectedCategoryId = editedFields.categoryId ?? data.categoryId;
  const selectedDate = editedFields.date ?? data.date;
  const notesValue = editedFields.notes ?? data.notes ?? '';

  // Check if field is missing (for inbox warning styling)
  const isAccountMissing = mode === 'inbox' && !selectedAccountId;
  const isCategoryMissing = mode === 'inbox' && !selectedCategoryId;

  // Resolve selected objects early for clean JSX
  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  // Parse date for calendar
  const parsedDate = selectedDate ? new Date(selectedDate) : undefined;

  // MULTI-CURRENCY GATEKEEPER: Detect currency mismatch
  // Show exchange rate field only when selected account currency differs from user's main currency
  // CRITICAL: Compare to mainCurrency (NOT data.currency which is temporary import metadata)
  const requiresExchangeRate = selectedAccount && selectedAccount.currencyCode !== mainCurrency;
  const exchangeRateValue = editedFields.exchangeRate ?? data.exchangeRate ?? undefined;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Account Selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Account
          </span>
        </label>
        <Select
          value={selectedAccountId || undefined}
          onValueChange={(value) => onFieldChange('accountId', value)}
          disabled={isLocked}
        >
          <SelectTrigger
            className={cn(
              'w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-gray-200 transition-colors',
              isAccountMissing && 'border-orange-200 text-orange-600 bg-white',
              isLocked && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SelectValue placeholder="Select account...">
              {selectedAccount ? (
                <div className="flex items-center gap-2">
                  <span>{selectedAccount.name}</span>
                  {/* CRITICAL: Always use currencyCode (not currencySymbol) for unambiguous display */}
                  <span className="text-xs text-gray-400">{selectedAccount.currencyCode}</span>
                </div>
              ) : (
                'Select account...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  <span>{account.name}</span>
                  {/* CRITICAL: Always use currencyCode (not currencySymbol) for unambiguous display */}
                  <span className="text-xs text-gray-400">{account.currencyCode}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reconciliation Status Badge */}
      {data.reconciliationId && reconciliation && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <FileCheck className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Reconciliation
            </span>
          </label>
          <div className={cn(
            "flex items-center gap-2 px-4 py-3 border rounded-xl",
            reconciliation.status === 'completed'
              ? "bg-green-50 border-green-200"
              : "bg-blue-50 border-blue-200"
          )}>
            <FileCheck className={cn(
              "w-4 h-4",
              reconciliation.status === 'completed' ? "text-green-600" : "text-blue-600"
            )} />
            <div className="flex-1">
              <span className={cn(
                "text-sm font-medium",
                reconciliation.status === 'completed' ? "text-green-700" : "text-blue-700"
              )}>
                {reconciliation.name}
              </span>
              {reconciliation.status === 'completed' && (
                <p className="text-xs text-green-600 mt-0.5">
                  Amount, Date, and Account are locked
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Selector */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Hash className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Category
          </span>
        </label>
        <Select
          value={selectedCategoryId || undefined}
          onValueChange={(value) => onFieldChange('categoryId', value)}
        >
          <SelectTrigger
            className={cn(
              'w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-gray-200 transition-colors',
              isCategoryMissing && 'border-orange-200 text-orange-600 bg-white'
            )}
          >
            <SelectValue placeholder="Select category...">
              {selectedCategory ? (
                <span>{selectedCategory.name}</span>
              ) : (
                'Select category...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <span>{category.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Picker */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Date
          </span>
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={isLocked}
              className={cn(
                'w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium justify-start text-left focus:bg-white focus:border-gray-200 transition-colors',
                !parsedDate && 'text-gray-500',
                isLocked && 'opacity-50 cursor-not-allowed'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-gray-400" />
              {parsedDate ? format(parsedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-white shadow-xl border border-gray-100 rounded-lg" align="start">
            <Calendar
              mode="single"
              selected={parsedDate}
              onSelect={(date) => {
                if (date) {
                  onFieldChange('date', date.toISOString());
                }
              }}
              initialFocus
              disabled={isLocked}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Exchange Rate Field - REACTIVE: Only shows when currencies differ */}
      {requiresExchangeRate && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
              Exchange Rate
            </span>
            <span className="text-[9px] text-orange-600 font-semibold uppercase tracking-wider">
              Required
            </span>
          </label>
          <div className="space-y-1">
            <Input
              type="number"
              step="0.0001"
              min="0"
              value={exchangeRateValue ?? ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) {
                  onFieldChange('exchangeRate', value);
                }
              }}
              placeholder="e.g., 1.18"
              className={cn(
                'w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-gray-200 transition-colors',
                !exchangeRateValue && 'border-orange-200 bg-white'
              )}
            />
            <p className="text-xs text-gray-500 px-1">
              1 {mainCurrency} = ? {selectedAccount?.currencyCode}
            </p>
          </div>
        </div>
      )}

      {/* Notes Textarea */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
            Notes
          </span>
        </label>
        <Textarea
          value={notesValue}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          placeholder="Add notes or memo..."
          className="w-full bg-white border-gray-100 rounded-xl px-4 py-3 text-sm font-medium resize-none focus:bg-white focus:border-gray-200 transition-colors min-h-[60px]"
        />
      </div>
    </div>
  );
}

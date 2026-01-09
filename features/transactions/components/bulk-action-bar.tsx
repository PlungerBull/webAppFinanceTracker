'use client';

import { X, Hash, CreditCard, Calendar as CalendarIcon, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { SmartSelector } from './smart-selector';
import { CategorySelector } from './category-selector';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onApply: () => void;
  isApplying: boolean;
  canApply: boolean;

  // Field selectors
  categoryValue?: string;
  onCategoryChange: (categoryId: string | undefined) => void;

  accountValue?: string;
  onAccountChange: (accountId: string | undefined) => void;

  dateValue?: string;
  onDateChange: (date: string | undefined) => void;

  notesValue?: string;
  onNotesChange: (notes: string | undefined) => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onApply,
  isApplying,
  canApply,
  categoryValue,
  onCategoryChange,
  accountValue,
  onAccountChange,
  dateValue,
  onDateChange,
  notesValue,
  onNotesChange,
}: BulkActionBarProps) {
  const leafCategories = useLeafCategories();
  const { data: groupedAccounts = [] } = useGroupedAccounts();

  // Get display names for selected values
  const selectedCategory = leafCategories.find(c => c.id === categoryValue);
  const selectedAccount = groupedAccounts.find(g => g.groupId === accountValue);

  // Flatten accounts for selection
  const flatAccounts = groupedAccounts.map(group => ({
    id: group.groupId,
    name: group.name,
    color: group.color,
  }));

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-gray-300 bg-slate-900 shadow-2xl">
      <div className="flex items-center gap-4 px-6 py-4">
        {/* Selection Count Badge */}
        <div className="flex items-center gap-2">
          <Checkbox checked disabled className="border-gray-600" />
          <span className="text-sm font-semibold text-white">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-gray-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-gray-700" />

        {/* Category Selector */}
        <div className="relative">
          <SmartSelector
            icon={Hash}
            label="Category"
            value={selectedCategory?.name}
            placeholder="No Change"
            className="bg-slate-800 border-slate-700 text-white hover:border-slate-600"
          >
            <CategorySelector
              value={categoryValue}
              onChange={onCategoryChange}
            />
          </SmartSelector>
          {categoryValue && (
            <button
              onClick={() => onCategoryChange(undefined)}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Account Selector */}
        <div className="relative">
          <SmartSelector
            icon={CreditCard}
            label="Account"
            value={selectedAccount?.name}
            placeholder="No Change"
            className="bg-slate-800 border-slate-700 text-white hover:border-slate-600"
          >
            <div className="w-72 max-h-96 overflow-y-auto p-2">
              {flatAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onAccountChange(account.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                    accountValue === account.id
                      ? "bg-gray-100 text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: account.color }}
                  />
                  <span className="flex-1 text-left truncate">{account.name}</span>
                  {accountValue === account.id && (
                    <X className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              ))}
            </div>
          </SmartSelector>
          {accountValue && (
            <button
              onClick={() => onAccountChange(undefined)}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Date Selector */}
        <div className="relative">
          <SmartSelector
            icon={CalendarIcon}
            label="Date"
            value={dateValue ? format(new Date(dateValue), 'MMM dd, yyyy') : undefined}
            placeholder="No Change"
            className="bg-slate-800 border-slate-700 text-white hover:border-slate-600"
          >
            <Calendar
              mode="single"
              selected={dateValue ? new Date(dateValue) : undefined}
              onSelect={(date) => onDateChange(date?.toISOString())}
              initialFocus
            />
          </SmartSelector>
          {dateValue && (
            <button
              onClick={() => onDateChange(undefined)}
              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-700 hover:bg-slate-600 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Notes Input */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <Input
            placeholder="Add notes..."
            value={notesValue || ''}
            onChange={(e) => onNotesChange(e.target.value || undefined)}
            className="w-48 bg-slate-800 border-slate-700 text-white placeholder:text-gray-500"
          />
          {notesValue && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNotesChange(undefined)}
              className="text-gray-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Apply Button */}
        <Button
          onClick={onApply}
          disabled={!canApply || isApplying}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isApplying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            `Apply to ${selectedCount} transaction${selectedCount !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}

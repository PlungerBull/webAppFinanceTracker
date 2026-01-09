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
    <div className="fixed bottom-6 left-6 right-6 z-30 flex justify-center animate-in fade-in slide-in-from-bottom-4">
      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900 shadow-xl">
        {/* Zone A: Selection Meta */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {selectedCount} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-slate-700" />

        {/* Zone B: Actions */}

        {/* Category Button */}
        <div className="relative">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
            <Hash className="size-3.5 text-blue-400" />
            <span>Category</span>
          </button>
          <div className="absolute inset-0 opacity-0">
            <SmartSelector
              icon={Hash}
              label="Category"
              value={selectedCategory?.name}
              placeholder="No Change"
              className="bg-transparent border-0"
            >
              <CategorySelector
                value={categoryValue}
                onChange={onCategoryChange}
              />
            </SmartSelector>
          </div>
        </div>

        {/* Account Button */}
        <div className="relative">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
            <CreditCard className="size-3.5 text-green-400" />
            <span>Account</span>
          </button>
          <div className="absolute inset-0 opacity-0">
            <SmartSelector
              icon={CreditCard}
              label="Account"
              value={selectedAccount?.name}
              placeholder="No Change"
              className="bg-transparent border-0"
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
          </div>
        </div>

        {/* Date Button */}
        <div className="relative">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
            <CalendarIcon className="size-3.5 text-orange-400" />
            <span>Date</span>
          </button>
          <div className="absolute inset-0 opacity-0">
            <SmartSelector
              icon={CalendarIcon}
              label="Date"
              value={dateValue ? format(new Date(dateValue), 'MMM dd, yyyy') : undefined}
              placeholder="No Change"
              className="bg-transparent border-0"
            >
              <Calendar
                mode="single"
                selected={dateValue ? new Date(dateValue) : undefined}
                onSelect={(date) => onDateChange(date?.toISOString())}
                initialFocus
              />
            </SmartSelector>
          </div>
        </div>
      </div>
    </div>
  );
}

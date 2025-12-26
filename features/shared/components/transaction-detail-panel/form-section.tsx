'use client';

import { Building2, Hash, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
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
import type { PanelMode, EditedFields, PanelData, SelectableAccount, SelectableCategory } from './types';

interface FormSectionProps {
  mode: PanelMode;
  data: PanelData;
  editedFields: EditedFields;
  onFieldChange: (field: keyof EditedFields, value: string) => void;
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

  // Debug logging
  console.log('FormSection Debug:', {
    selectedAccountId,
    selectedCategoryId,
    accountsCount: accounts.length,
    categoriesCount: categories.length,
    selectedAccount,
    selectedCategory,
    dataAccountId: data.accountId,
    dataCategoryId: data.categoryId
  });

  // Parse date for calendar
  const parsedDate = selectedDate ? new Date(selectedDate) : undefined;

  return (
    <div className="px-6 py-4 space-y-4">
      {/* TEMPORARY DEBUG - REMOVE AFTER FIXING */}
      <div className="p-2 bg-red-100 border border-red-300 rounded text-xs">
        <div>AccountID: {selectedAccountId || 'NULL'}</div>
        <div>CategoryID: {selectedCategoryId || 'NULL'}</div>
        <div>SelectedAccount: {selectedAccount?.name || 'NOT FOUND'}</div>
        <div>SelectedCategory: {selectedCategory?.name || 'NOT FOUND'}</div>
        <div>Accounts.length: {accounts.length}</div>
        <div>Categories.length: {categories.length}</div>
      </div>

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
        >
          <SelectTrigger
            className={cn(
              'w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-gray-200 transition-colors',
              isAccountMissing && 'border-orange-200 text-orange-600 bg-orange-50/30'
            )}
          >
            <SelectValue placeholder="Select account...">
              {selectedAccount ? (
                <div className="flex items-center gap-2">
                  {selectedAccount.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: selectedAccount.color }}
                    />
                  )}
                  <span>{selectedAccount.name}</span>
                  <span className="text-xs text-gray-400">{selectedAccount.currencySymbol}</span>
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
                  {account.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: account.color }}
                    />
                  )}
                  <span>{account.name}</span>
                  <span className="text-xs text-gray-400">{account.currencySymbol}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
              'w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium focus:bg-white focus:border-gray-200 transition-colors',
              isCategoryMissing && 'border-orange-200 text-orange-600 bg-orange-50/30'
            )}
          >
            <SelectValue placeholder="Select category...">
              {selectedCategory ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedCategory.color }}
                  />
                  <span>{selectedCategory.name}</span>
                </div>
              ) : (
                'Select category...'
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span>{category.name}</span>
                </div>
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
              className={cn(
                'w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium justify-start text-left focus:bg-white focus:border-gray-200 transition-colors',
                !parsedDate && 'text-gray-500'
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
            />
          </PopoverContent>
        </Popover>
      </div>

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
          className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-medium resize-none focus:bg-white focus:border-gray-200 transition-colors min-h-[60px]"
        />
      </div>
    </div>
  );
}

'use client';

import { X, Hash, CreditCard, Calendar as CalendarIcon, FileText, Loader2, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { SmartSelector } from './smart-selector';
import { CategorySelector } from './category-selector';
import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { useGroupedAccounts } from '@/hooks/use-grouped-accounts';
import { useReconciliations, useReconciliationSummary } from '@/features/reconciliations/hooks/use-reconciliations';
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

  // Reconciliation props
  reconciliationValue?: string | null;
  onReconciliationChange: (reconciliationId: string | null | undefined) => void;
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
  reconciliationValue,
  onReconciliationChange,
}: BulkActionBarProps) {
  const leafCategories = useLeafCategories();
  const { data: groupedAccounts = [] } = useGroupedAccounts();
  const { data: reconciliations = [] } = useReconciliations();
  const { data: reconciliationSummary } = useReconciliationSummary(reconciliationValue);

  // Get display names for selected values
  const selectedCategory = leafCategories.find((c) => c.id === categoryValue);
  const selectedAccount = groupedAccounts.find((g) => g.groupId === accountValue);
  const selectedReconciliation = reconciliations.find((r) => r.id === reconciliationValue);

  // Flatten accounts for selection
  const flatAccounts = groupedAccounts.map((group) => ({
    id: group.groupId,
    name: group.name,
    color: group.color,
  }));

  // Filter reconciliations to only show draft status (cannot link to completed)
  const draftReconciliations = reconciliations.filter((r) => r.status === 'draft');

  return (
    <div className="fixed bottom-6 left-6 right-6 z-30 flex justify-center animate-in fade-in slide-in-from-bottom-4">
      <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-900 shadow-xl">
        {/* Zone A: Selection Meta */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{selectedCount} selected</span>
          <button
            onClick={onClearSelection}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="h-8 w-px bg-slate-700" />

        {/* Zone B: Standard Actions */}

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
              <CategorySelector value={categoryValue} onChange={onCategoryChange} />
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
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                      accountValue === account.id
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: account.color }}
                    />
                    <span className="flex-1 text-left truncate">{account.name}</span>
                    {accountValue === account.id && <X className="w-4 h-4 text-gray-500" />}
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

        {/* Reconciliation Selector */}
        <div className="relative">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
            <FileCheck className="size-3.5 text-purple-400" />
            <span>Reconciliation</span>
          </button>
          <div className="absolute inset-0 opacity-0">
            <SmartSelector
              icon={FileCheck}
              label="Reconciliation"
              value={selectedReconciliation?.name}
              placeholder="No Change"
              className="bg-transparent border-0"
            >
              <div className="w-72 max-h-96 overflow-y-auto p-2">
                {/* Clear option */}
                <button
                  type="button"
                  onClick={() => onReconciliationChange(undefined)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    reconciliationValue === undefined
                      ? 'bg-gray-100 text-gray-900 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  )}
                >
                  <span className="flex-1 text-left">Clear (Unlink)</span>
                  {reconciliationValue === undefined && <X className="w-4 h-4 text-gray-500" />}
                </button>

                {draftReconciliations.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-4">
                    No draft reconciliations available
                  </div>
                ) : (
                  draftReconciliations.map((reconciliation) => (
                    <button
                      key={reconciliation.id}
                      type="button"
                      onClick={() => onReconciliationChange(reconciliation.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                        reconciliationValue === reconciliation.id
                          ? 'bg-gray-100 text-gray-900 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <span className="flex-1 text-left truncate">{reconciliation.name}</span>
                      {reconciliationValue === reconciliation.id && (
                        <X className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </SmartSelector>
          </div>
        </div>

        {/* Reconciliation Math Display (only when a reconciliation is selected) */}
        {reconciliationValue && reconciliationSummary && (
          <>
            {/* Vertical Divider */}
            <div className="h-8 w-px bg-slate-700" />

            {/* Math Display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
              <div className="text-xs text-slate-300">
                <span className="font-mono">
                  Diff: {reconciliationSummary.difference.toFixed(2)}
                </span>
                {reconciliationSummary.isBalanced && (
                  <span className="ml-2 text-green-400">✓</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Vertical Divider before Apply */}
        <div className="h-8 w-px bg-slate-700" />

        {/* Apply Button */}
        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:bg-slate-800 h-auto py-1.5 px-3"
          onClick={onApply}
          disabled={!canApply || isApplying}
        >
          {isApplying ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : null}
          Apply
        </Button>
      </div>
    </div>
  );
}

'use client';

import { X, Hash, CreditCard, Calendar as CalendarIcon, Loader2, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { SmartSelector } from './smart-selector';
import { CategorySelector } from '@/components/shared/category-selector';
import { useCategoriesData } from '@/lib/hooks/use-reference-data';
import { useGroupedAccounts } from '@/lib/hooks/use-grouped-accounts';
import { useReconciliations, useReconciliationSummary } from '@/lib/hooks/use-reconciliations';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { centsToDisplayAmount } from '@/lib/utils/cents-parser';

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

  // Real-time diff calculation
  selectedIds?: Set<string>;
  transactions?: Array<{ id: string; amountHomeCents: number; reconciliationId?: string | null }>;
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
  // notesValue, onNotesChange - intentionally not destructured (feature not yet implemented)
  reconciliationValue,
  onReconciliationChange,
  selectedIds,
  transactions = [],
}: BulkActionBarProps) {
  const { categories: leafCategories } = useCategoriesData();
  const { data: groupedAccounts = [] } = useGroupedAccounts();
  const { data: reconciliations = [] } = useReconciliations();
  const { data: reconciliationSummary } = useReconciliationSummary(reconciliationValue);

  // Get display names for selected values
  const selectedCategory = leafCategories.find((c) => c.id === categoryValue);
  const selectedAccountRaw = groupedAccounts.find((g) => g.groupId === accountValue);
  const selectedReconciliation = reconciliations.find((r) => r.id === reconciliationValue);

  // Transform account data for clean display (flatten currency from balances array)
  const selectedAccount = selectedAccountRaw ? {
    ...selectedAccountRaw,
    displayCurrency: selectedAccountRaw.balances[0]?.currency ?? 'USD'
  } : undefined;

  // Flatten accounts for selection
  const flatAccounts = groupedAccounts.map((group) => ({
    id: group.groupId,
    name: group.name,
    color: group.color,
  }));

  // Filter reconciliations to only show draft status (cannot link to completed)
  const draftReconciliations = reconciliations.filter((r) => r.status === 'draft');

  // Real-time diff calculation: Calculate preview of diff if reconciliation is selected
  const previewDiff = useMemo(() => {
    if (!reconciliationValue || !reconciliationSummary || !selectedIds || !transactions.length) {
      return null;
    }

    const selectedReconciliation = reconciliations.find((r) => r.id === reconciliationValue);
    if (!selectedReconciliation) return null;

    // Get all transactions that would be linked after apply
    const selectedTransactionIds = Array.from(selectedIds);
    const selectedTransactions = transactions.filter((t) => selectedTransactionIds.includes(t.id));

    // Calculate sum of selected transactions in integer cents first, then convert once
    // This avoids floating-point accumulation errors from repeated division
    const selectedSumCents = selectedTransactions.reduce((sum, t) => sum + t.amountHomeCents, 0);
    const selectedSum = centsToDisplayAmount(selectedSumCents);

    // Calculate preview difference with rounding to prevent float drift
    // Formula: Ending Balance - (Beginning Balance + Current Linked Sum + Selected Sum)
    const currentLinkedSum = reconciliationSummary.linkedSum;
    const previewLinkedSum = Math.round((currentLinkedSum + selectedSum) * 100) / 100;
    const previewDifference = Math.round(
      (selectedReconciliation.endingBalance - (selectedReconciliation.beginningBalance + previewLinkedSum)) * 100
    ) / 100;

    return {
      difference: previewDifference,
      isBalanced: Math.abs(previewDifference) < 0.005, // Half a cent tolerance
    };
  }, [reconciliationValue, reconciliationSummary, selectedIds, transactions, reconciliations]);

  return (
    <div
      className="fixed bottom-4 md:bottom-6 left-2 right-2 md:left-6 md:right-6 flex justify-center animate-in fade-in slide-in-from-bottom-4"
      style={{ zIndex: 'var(--z-bulk-bar)' }}
    >
      <div className="w-full md:w-auto md:inline-flex flex flex-col md:flex-row items-center gap-2 md:gap-3 px-3 md:px-4 py-2 rounded-2xl bg-slate-900 shadow-xl">
        {/* Row 1 on mobile: Selection Meta + Primary Actions */}
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-start">
          {/* Zone A: Selection Meta */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{selectedCount}</span>
            <span className="text-sm font-semibold text-white hidden md:inline">selected</span>
            <button
              onClick={onClearSelection}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Vertical Divider - desktop only */}
          <div className="h-8 w-px bg-slate-700 hidden md:block" />

          {/* Zone B: Standard Actions - first row */}

          {/* Category Button */}
          <div className="relative">
            <button className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
              <Hash className="size-3.5 text-blue-400" />
              <span className={cn("truncate max-w-[80px] md:max-w-[120px] hidden md:inline", selectedCategory && "font-semibold")}>
                {selectedCategory?.name || 'Category'}
              </span>
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
            <button className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
              <CreditCard className="size-3.5 text-green-400" />
              <span className={cn("truncate max-w-[80px] md:max-w-[120px] hidden md:inline", selectedAccount && "font-semibold")}>
                {selectedAccount ? `${selectedAccount.name} (${selectedAccount.displayCurrency})` : 'Account'}
              </span>
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
            <button className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
              <CalendarIcon className="size-3.5 text-orange-400" />
              <span className={cn("truncate max-w-[80px] md:max-w-[120px] hidden md:inline", dateValue && "font-semibold")}>
                {dateValue ? format(new Date(dateValue), 'MMM dd, yyyy') : 'Date'}
              </span>
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

        {/* Row 2 on mobile: Reconciliation + Apply */}
        <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto justify-between md:justify-start">
          {/* Reconciliation Selector */}
          <div className="relative">
            <button className="flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:bg-slate-800 transition-colors">
              <FileCheck className="size-3.5 text-purple-400" />
              <span className={cn("truncate max-w-[80px] md:max-w-[120px] hidden md:inline", selectedReconciliation && "font-semibold")}>
                {selectedReconciliation?.name || 'Reconciliation'}
              </span>
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
          {reconciliationValue && (previewDiff || reconciliationSummary) && (
            <>
              {/* Vertical Divider - desktop only */}
              <div className="h-8 w-px bg-slate-700 hidden md:block" />

              {/* Math Display */}
              <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-slate-800 rounded-lg">
                <div className="text-xs text-slate-300">
                  <span className="font-mono">
                    Diff: {(previewDiff?.difference ?? reconciliationSummary?.difference ?? 0).toFixed(2)}
                  </span>
                  {(previewDiff?.isBalanced ?? reconciliationSummary?.isBalanced) && (
                    <span className="ml-2 text-green-400">✓</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Vertical Divider before Apply - desktop only */}
          <div className="h-8 w-px bg-slate-700 hidden md:block" />

          {/* Apply Button */}
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-slate-800 h-auto py-1.5 px-2 md:px-3"
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
    </div>
  );
}

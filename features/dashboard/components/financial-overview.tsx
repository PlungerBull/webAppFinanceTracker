'use client';

import React, { useMemo, useState } from 'react';
import { Loader2, ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { useFinancialOverview, type CategoryMonthlyData } from '../hooks/use-financial-overview';
import { formatCurrencyShort } from '@/lib/hooks/use-formatted-balance';
import { UI } from '@/lib/constants';
import { startOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { fromCents } from '@/lib/utils/cents-conversion';

// Helper types for grouped data
interface CategoryGroup {
  parent: CategoryMonthlyData;
  children: CategoryMonthlyData[];
  totals: Record<string, number>;
}

export function FinancialOverview() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Fetch data with main currency
  const { data: overviewData, isLoading } = useFinancialOverview(UI.MONTHS_DISPLAY.SPENDING_TABLE);

  // CRITICAL: Generate 6-month skeleton FIRST (prevents grid collapse with sparse data)
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = UI.MONTHS_DISPLAY.SPENDING_TABLE - 1; i >= 0; i--) {
      result.push(startOfMonth(subMonths(today, i)));
    }
    return result; // Oldest to newest
  }, []);

  // Grouping logic (parent-child hierarchy)
  const groupCategories = useMemo(() => {
    return (categories: CategoryMonthlyData[]): CategoryGroup[] => {
      const parents = categories.filter(cat => !cat.parentId);
      const children = categories.filter(cat => cat.parentId);

      return parents.map(parent => {
        const groupChildren = children.filter(child => child.parentId === parent.categoryId);

        // Calculate totals for the parent row (Sum of children)
        // HARDENED: Data is now in integer cents - pure integer arithmetic
        const totals: Record<string, number> = {};
        months.forEach(month => {
          const monthKey = month.toISOString().slice(0, 7);
          const childrenSum = groupChildren.reduce((sum, child) => {
            return sum + (child.monthlyAmounts[monthKey] || 0);
          }, 0);
          totals[monthKey] = childrenSum;  // No Math.round needed - integer cents
        });

        return {
          parent,
          children: groupChildren,
          totals
        };
      });
    };
  }, [months]);

  const incomeGroups = useMemo(() =>
    overviewData ? groupCategories(overviewData.incomeCategories) : [],
    [overviewData, groupCategories]
  );

  const expenseGroups = useMemo(() =>
    overviewData ? groupCategories(overviewData.expenseCategories) : [],
    [overviewData, groupCategories]
  );

  // HARDENED: Pure integer arithmetic - data is in cents
  const incomeTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach(month => {
      const monthKey = month.toISOString().slice(0, 7);
      const monthTotal = incomeGroups.reduce((sum, group) => {
        return sum + (group.totals[monthKey] || 0);
      }, 0);
      totals[monthKey] = monthTotal;  // No Math.round needed - integer cents
    });
    return totals;
  }, [incomeGroups, months]);

  const expenseTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    months.forEach(month => {
      const monthKey = month.toISOString().slice(0, 7);
      const monthTotal = expenseGroups.reduce((sum, group) => {
        return sum + (group.totals[monthKey] || 0);
      }, 0);
      totals[monthKey] = monthTotal;  // No Math.round needed - integer cents
    });
    return totals;
  }, [expenseGroups, months]);

  const netCashFlow = useMemo(() => {
    const flow: Record<string, number> = {};
    months.forEach(month => {
      const monthKey = month.toISOString().slice(0, 7);
      const income = incomeTotals[monthKey] || 0;
      const expense = expenseTotals[monthKey] || 0;
      flow[monthKey] = income - expense;  // No Math.round needed - integer cents
    });
    return flow;
  }, [incomeTotals, expenseTotals, months]);

  // Initialize expanded state once data is loaded (all groups expanded by default)
  React.useEffect(() => {
    if (overviewData && expandedGroups.size === 0) {
      const allIds = new Set<string>();
      [...overviewData.incomeCategories, ...overviewData.expenseCategories]
        .filter(c => !c.parentId)
        .forEach(c => allIds.add(c.categoryId));
      setExpandedGroups(allIds);
    }
  }, [overviewData, expandedGroups.size]);

  const toggleGroup = (categoryId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedGroups(newExpanded);
  };

  // CTO Refinement #4: Currency integrity - use mainCurrency from hook, fallback to prevent crash
  const mainCurrency = overviewData?.mainCurrency || 'USD';

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state handling (CTO requirement)
  if (incomeGroups.length === 0 && expenseGroups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No transactions yet
      </div>
    );
  }

  // Render individual month cells with CTO Refinement #3: Tabular numbers
  // HARDENED: amount is in cents, use fromCents() for display
  const renderMonthCells = (amounts: Record<string, number>, type: 'income' | 'expense', isParent = false) => {
    return months.map((month) => {
      const monthKey = month.toISOString().slice(0, 7);
      const amountCents = amounts[monthKey] ?? 0; // COALESCE to 0

      return (
        <div key={month.toISOString()} className={cn(
          "text-right text-[13px] font-mono tabular-nums",
          isParent ? "font-semibold text-gray-700" : "text-gray-600"
        )}>
          {amountCents > 0 ? (
            <span className={type === 'income' ? 'text-emerald-600' : ''}>
              {formatCurrencyShort(fromCents(amountCents), mainCurrency)}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>
      );
    });
  };

  // Render category group (parent + children)
  const renderGroup = (group: CategoryGroup, type: 'income' | 'expense') => {
    const isExpanded = expandedGroups.has(group.parent.categoryId);

    return (
      <React.Fragment key={group.parent.categoryId}>
        {/* Parent Row */}
        <div
          className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 hover:bg-white cursor-pointer transition-colors group border-b border-gray-100"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => toggleGroup(group.parent.categoryId)}
        >
          <div className="py-4 flex items-center gap-3">
            {/* Colored Spine */}
            <div
              className="w-1 h-5 rounded-r-md transition-all"
              style={{ backgroundColor: group.parent.categoryColor }}
            />

            {/* Expand Icon */}
            <div className="text-gray-400">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>

            <span className="font-semibold text-gray-700 text-[13px]">
              {group.parent.categoryName}
            </span>
          </div>
          {renderMonthCells(group.totals, type, true)}
        </div>

        {/* Child Rows */}
        {isExpanded && group.children.map(child => (
          <div
            key={child.categoryId}
            className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 hover:bg-white transition-colors border-b border-gray-50"
            style={{ gridColumn: '1 / -1' }}
          >
            <div className="py-3 pl-12 border-l-2 border-gray-100/60">
              <span className="text-[12px] text-gray-500 font-medium">
                {child.categoryName}
              </span>
            </div>
            {renderMonthCells(child.monthlyAmounts, type, false)}
          </div>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="h-full overflow-y-auto scrollbar-hide">
      {/* CSS Grid Container */}
      <div className="w-full">
        {/* Grid Layout: 1fr (flexible) + 6 fixed 85px columns */}
        <div className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 px-6">

          {/* Sticky Header Row */}
          <div className="sticky top-0 bg-white z-10 grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 border-b border-gray-200" style={{ gridColumn: '1 / -1' }}>
            <div className="py-5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]">
              Categorization
            </div>
            {months.map((month) => (
              <div
                key={month.toISOString()}
                className="py-5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em]"
              >
                {month.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Income Section */}
          {incomeGroups.length > 0 && (
            <>
              <div className="h-6" style={{ gridColumn: '1 / -1' }} />
              <div className="pb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '1 / -1' }}>
                Income
              </div>
              {incomeGroups.map(group => renderGroup(group, 'income'))}

              {/* TOTAL INCOME Row - HARDENED: cents to decimal for display */}
              <div className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 bg-white border-y border-emerald-200" style={{ gridColumn: '1 / -1' }}>
                <div className="py-4 text-[12px] font-bold text-emerald-700 uppercase tracking-wide">
                  Total Income
                </div>
                {months.map((month) => {
                  const monthKey = month.toISOString().slice(0, 7);
                  const amountCents = incomeTotals[monthKey] ?? 0;
                  return (
                    <div key={month.toISOString()} className="py-4 text-right text-[13px] font-mono font-bold text-emerald-700 tabular-nums">
                      {amountCents > 0 ? formatCurrencyShort(fromCents(amountCents), mainCurrency) : '—'}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Expenses Section */}
          {expenseGroups.length > 0 && (
            <>
              <div className="h-8" style={{ gridColumn: '1 / -1' }} />
              <div className="pb-2 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '1 / -1' }}>
                Expenses
              </div>
              {expenseGroups.map(group => renderGroup(group, 'expense'))}

              {/* TOTAL EXPENSES Row - HARDENED: cents to decimal for display */}
              <div className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 bg-white border-y border-rose-200" style={{ gridColumn: '1 / -1' }}>
                <div className="py-4 text-[12px] font-bold text-rose-700 uppercase tracking-wide">
                  Total Expenses
                </div>
                {months.map((month) => {
                  const monthKey = month.toISOString().slice(0, 7);
                  const amountCents = expenseTotals[monthKey] ?? 0;
                  return (
                    <div key={month.toISOString()} className="py-4 text-right text-[13px] font-mono font-bold text-rose-700 tabular-nums">
                      {amountCents > 0 ? formatCurrencyShort(fromCents(amountCents), mainCurrency) : '—'}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* NET CASH FLOW Row - HARDENED: cents to decimal for display */}
          <div className="h-8" style={{ gridColumn: '1 / -1' }} />
          <div className="grid grid-cols-[1fr_repeat(6,minmax(100px,1fr))] gap-x-4 bg-white border-y-2 border-gray-300" style={{ gridColumn: '1 / -1' }}>
            <div className="py-5 flex items-center gap-2 text-[13px] font-bold text-gray-900 uppercase tracking-wide">
              <ArrowRightLeft className="h-4 w-4" />
              Net Cash Flow
            </div>
            {months.map((month) => {
              const monthKey = month.toISOString().slice(0, 7);
              const flowCents = netCashFlow[monthKey] ?? 0;
              const isPositive = flowCents >= 0;
              return (
                <div
                  key={month.toISOString()}
                  className={cn(
                    "py-5 text-right text-[14px] font-mono font-bold tabular-nums",
                    isPositive ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {flowCents !== 0 ? formatCurrencyShort(fromCents(flowCents), mainCurrency) : '—'}
                </div>
              );
            })}
          </div>

          {/* Bottom Spacing */}
          <div className="h-8" style={{ gridColumn: '1 / -1' }} />

        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useFinancialOverview, type CategoryMonthlyData } from '../hooks/use-financial-overview';
import { formatCurrencyShort } from '@/hooks/use-formatted-balance';
import { UI } from '@/lib/constants';
import { startOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

// Helper types for grouped data
interface CategoryGroup {
  parent: CategoryMonthlyData;
  children: CategoryMonthlyData[];
  totals: Record<string, number>;
}

export function FinancialOverview() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Generate months array
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < UI.MONTHS_DISPLAY.SPENDING_TABLE; i++) {
      result.push(startOfMonth(subMonths(today, i)));
    }
    return result.reverse(); // Oldest to newest
  }, []);

  // Fetch data
  const { data: overviewData, isLoading } = useFinancialOverview(UI.MONTHS_DISPLAY.SPENDING_TABLE);

  // Grouping logic
  const groupCategories = (categories: CategoryMonthlyData[]): CategoryGroup[] => {
    const parents = categories.filter(cat => !cat.parentId);
    const children = categories.filter(cat => cat.parentId);

    return parents.map(parent => {
      const groupChildren = children.filter(child => child.parentId === parent.categoryId);

      // Calculate totals for the parent row (Sum of children)
      const totals: Record<string, number> = {};
      months.forEach(month => {
        const monthKey = month.toISOString().slice(0, 7);
        const childrenSum = groupChildren.reduce((sum, child) => {
          return sum + (child.monthlyAmounts[monthKey] || 0);
        }, 0);
        totals[monthKey] = childrenSum;
      });

      return {
        parent,
        children: groupChildren,
        totals
      };
    });
  };

  const incomeGroups = useMemo(() =>
    overviewData ? groupCategories(overviewData.incomeCategories) : [],
    [overviewData, months]
  );

  const expenseGroups = useMemo(() =>
    overviewData ? groupCategories(overviewData.expenseCategories) : [],
    [overviewData, months]
  );

  // Initialize expanded state once data is loaded
  useEffect(() => {
    if (overviewData && expandedGroups.size === 0) {
      const allIds = new Set<string>();
      [...overviewData.incomeCategories, ...overviewData.expenseCategories]
        .filter(c => !c.parentId)
        .forEach(c => allIds.add(c.categoryId));
      setExpandedGroups(allIds);
    }
  }, [overviewData]);

  const toggleGroup = (categoryId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedGroups(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (incomeGroups.length === 0 && expenseGroups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No transactions yet
      </div>
    );
  }

  const renderMonthCells = (amounts: Record<string, number>, type: 'income' | 'expense', isParent = false) => {
    return months.map((month) => {
      const monthKey = month.toISOString().slice(0, 7);
      const amount = amounts[monthKey] || amounts[monthKey] === 0 ? amounts[monthKey] : 0;

      return (
        <td key={month.toISOString()} className={cn(
          "py-3 text-right text-sm",
          isParent ? "font-bold text-gray-900" : "text-gray-600"
        )}>
          {amount > 0 ? (
            <span className={type === 'income' ? 'text-green-600' : ''}>
              {formatCurrencyShort(amount, 'USD')}
            </span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
      );
    });
  };

  const renderGroup = (group: CategoryGroup, type: 'income' | 'expense') => {
    const isExpanded = expandedGroups.has(group.parent.categoryId);

    return (
      <React.Fragment key={group.parent.categoryId}>
        {/* Parent Row */}
        <tr
          className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer group"
          onClick={() => toggleGroup(group.parent.categoryId)}
        >
          <td className="py-3 pl-0 pr-3">
            <div className="flex items-center gap-3">
              {/* Colored Spine */}
              <div
                className="w-1 h-5 rounded-r-md transition-all group-hover:h-6"
                style={{ backgroundColor: group.parent.categoryColor }}
              />

              {/* Expand Icon */}
              <div className="text-gray-400">
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>

              <span className="font-bold text-gray-800 text-sm">
                {group.parent.categoryName}
              </span>
            </div>
          </td>
          {renderMonthCells(group.totals, type, true)}
        </tr>

        {/* Child Rows */}
        {isExpanded && group.children.map(child => (
          <tr key={child.categoryId} className="border-b border-gray-50 hover:bg-gray-50/50">
            <td className="py-2.5 pl-12 pr-3">
              <span className="text-sm text-gray-500 font-medium">
                {child.categoryName}
              </span>
            </td>
            {renderMonthCells(child.monthlyAmounts, type, false)}
          </tr>
        ))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
            <tr>
              <th className="py-4 pl-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                Category
              </th>
              {months.map((month) => (
                <th
                  key={month.toISOString()}
                  className="py-4 px-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider min-w-[100px]"
                >
                  {month.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Income Section */}
            {incomeGroups.length > 0 && (
              <>
                <tr><td colSpan={months.length + 1} className="h-6"></td></tr>
                <tr>
                  <td colSpan={months.length + 1} className="pb-2 pl-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Income
                  </td>
                </tr>
                {incomeGroups.map(group => renderGroup(group, 'income'))}
              </>
            )}

            {/* Expenses Section */}
            {expenseGroups.length > 0 && (
              <>
                <tr><td colSpan={months.length + 1} className="h-8"></td></tr>
                <tr>
                  <td colSpan={months.length + 1} className="pb-2 pl-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Expenses
                  </td>
                </tr>
                {expenseGroups.map(group => renderGroup(group, 'expense'))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

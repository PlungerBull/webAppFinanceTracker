'use client';

import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useFinancialOverview } from '../hooks/use-financial-overview';
import { formatCurrencyShort } from '@/hooks/use-formatted-balance';
import { UI } from '@/lib/constants';
import { startOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

// Badge color mapping based on category type
const getBadgeStyles = (type: 'income' | 'expense') => {
  if (type === 'income') {
    return 'bg-green-100 text-green-700';
  }

  // For expenses, use a neutral style
  return 'bg-gray-100 text-gray-700';
};

// Convert hex color to tailwind-compatible background style
const getCategoryColorStyle = (color: string) => {
  return { backgroundColor: color };
};

export function FinancialOverview() {
  // Generate months array
  const months = useMemo(() => {
    const result = [];
    const today = new Date();
    for (let i = 0; i < UI.MONTHS_DISPLAY.SPENDING_TABLE; i++) {
      result.push(startOfMonth(subMonths(today, i)));
    }
    return result.reverse(); // Oldest to newest
  }, []);

  // Fetch data using custom hook
  const { data: overviewData, isLoading } = useFinancialOverview(UI.MONTHS_DISPLAY.SPENDING_TABLE);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const incomeCategories = overviewData?.incomeCategories || [];
  const expenseCategories = overviewData?.expenseCategories || [];

  if (incomeCategories.length === 0 && expenseCategories.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No transactions yet
      </div>
    );
  }

  // Organize categories by parent-child relationships
  const organizeCategories = (categories: typeof incomeCategories) => {
    const parents = categories.filter(cat => !cat.parentId);
    const children = categories.filter(cat => cat.parentId);

    const organized: Array<{ category: typeof categories[0], depth: number }> = [];

    parents.forEach(parent => {
      organized.push({ category: parent, depth: 0 });
      const parentChildren = children.filter(child => child.parentId === parent.categoryId);
      parentChildren.forEach(child => {
        organized.push({ category: child, depth: 1 });
      });
    });

    return organized;
  };

  const organizedIncome = organizeCategories(incomeCategories);
  const organizedExpenses = organizeCategories(expenseCategories);

  const renderCategoryRow = (
    item: { category: typeof incomeCategories[0], depth: number },
    type: 'income' | 'expense'
  ) => {
    const { category, depth } = item;
    const isParent = depth === 0;

    return (
      <tr key={category.categoryId} className="border-b border-gray-100">
        <td className="py-3" style={{ paddingLeft: `${depth * 20 + 12}px` }}>
          <div className="flex items-center gap-2">
            {/* Category color indicator from database */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={getCategoryColorStyle(category.categoryColor)}
              title={`${category.categoryName} category`}
            />
            <span className={cn(
              'text-sm',
              isParent ? 'font-semibold text-gray-800' : 'font-normal text-gray-600'
            )}>
              {category.categoryName}
            </span>
            {isParent && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase',
                getBadgeStyles(type)
              )}>
                {type}
              </span>
            )}
          </div>
        </td>
        {months.map((month) => {
          const monthKey = month.toISOString().slice(0, 7); // YYYY-MM
          const amount = category.monthlyAmounts[monthKey] || 0;
          return (
            <td key={month.toISOString()} className="py-3 text-right text-sm text-gray-800">
              {amount > 0 ? (
                <span className={type === 'income' ? 'text-green-600 font-medium' : ''}>
                  {formatCurrencyShort(amount, 'USD')}
                </span>
              ) : (
                '-'
              )}
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <div className="bg-white">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-gray-50">
            <tr>
              <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Category
              </th>
              {months.map((month) => (
                <th
                  key={month.toISOString()}
                  className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]"
                >
                  {month.toLocaleDateString('en-US', { month: 'short' })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Income Section */}
            {organizedIncome.length > 0 && (
              <>
                <tr className="bg-gray-50/50">
                  <td
                    colSpan={months.length + 1}
                    className="py-2 px-3 text-xs font-bold text-gray-400 uppercase"
                  >
                    Income
                  </td>
                </tr>
                {organizedIncome.map((item) => renderCategoryRow(item, 'income'))}
              </>
            )}

            {/* Expenses Section */}
            {organizedExpenses.length > 0 && (
              <>
                <tr className="bg-gray-50/50">
                  <td
                    colSpan={months.length + 1}
                    className="py-2 px-3 text-xs font-bold text-gray-400 uppercase"
                  >
                    Expenses
                  </td>
                </tr>
                {organizedExpenses.map((item) => renderCategoryRow(item, 'expense'))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

'use client';

import { useCategorizedCategories } from '@/features/categories/hooks/use-categorized-categories';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
}

export function CategorySelector({ value, onChange, disabled = false }: CategorySelectorProps) {
  const { income, expense } = useCategorizedCategories();

  const renderCategoryGroup = (group: typeof income[0]) => {
    const { parent, children } = group;

    // Skip if parent has no ID (shouldn't happen in practice)
    if (!parent.id) return null;

    return (
      <div key={parent.id} className="mb-2">
        {/* Parent Category */}
        <button
          type="button"
          onClick={() => !disabled && parent.id && onChange(parent.id)}
          disabled={disabled}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
            value === parent.id
              ? "bg-gray-100 text-gray-900 font-medium"
              : "text-gray-700 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: parent.color || '#gray' }}
          />
          <span className="flex-1 text-left">{parent.name || 'Unnamed'}</span>
          {value === parent.id && <Check className="w-4 h-4 text-gray-900" />}
        </button>

        {/* Child Categories */}
        {children.length > 1 && (
          <div className="ml-6 mt-1 space-y-1">
            {children.filter((child) => child.id).map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => !disabled && child.id && onChange(child.id)}
                disabled={disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  value === child.id
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-600 hover:bg-gray-50",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: child.color || '#gray' }}
                />
                <span className="flex-1 text-left">{child.name || 'Unnamed'}</span>
                {value === child.id && <Check className="w-4 h-4 text-gray-900" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-72 max-h-96 overflow-y-auto p-2">
      {/* Income Section */}
      {income.length > 0 && (
        <div className="mb-4">
          <div className="px-3 py-1 mb-2">
            <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
              Income
            </span>
          </div>
          {income.map(renderCategoryGroup)}
        </div>
      )}

      {/* Expense Section */}
      {expense.length > 0 && (
        <div>
          <div className="px-3 py-1 mb-2">
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">
              Expense
            </span>
          </div>
          {expense.map(renderCategoryGroup)}
        </div>
      )}

      {/* Empty State */}
      {income.length === 0 && expense.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-gray-400">
          No categories available
        </div>
      )}
    </div>
  );
}

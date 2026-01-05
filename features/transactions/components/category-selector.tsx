'use client';

import { useLeafCategories } from '@/features/categories/hooks/use-leaf-categories';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface CategorySelectorProps {
  value?: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
}

/**
 * Flat category selector using the "Invisible Grouping" pattern.
 *
 * - Shows only leaf categories (children + orphaned parents)
 * - No section headers or parent categories visible
 * - Color dots are the primary differentiator
 * - Sorted with income first, then expense, then alphabetically
 */
export function CategorySelector({ value, onChange, disabled = false }: CategorySelectorProps) {
  const leafCategories = useLeafCategories();

  return (
    <div className="w-72 max-h-96 overflow-y-auto p-2">
      {leafCategories.length > 0 ? (
        <div className="space-y-1">
          {leafCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => !disabled && onChange(category.id)}
              disabled={disabled}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                value === category.id
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-700 hover:bg-gray-50",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Category Name */}
              <span className="flex-1 text-left">{category.name}</span>

              {/* Checkmark */}
              {value === category.id && (
                <Check className="w-4 h-4 text-gray-900 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-8 text-center text-sm text-gray-400">
          No categories available
        </div>
      )}
    </div>
  );
}

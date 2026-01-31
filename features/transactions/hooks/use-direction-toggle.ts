import { useState, useEffect } from 'react';
import { useCategoriesData } from '@/lib/hooks/use-reference-data';

/**
 * Manages transaction direction state (-1 for outflow/paid, 1 for inflow/received)
 * Auto-sets based on category type but allows manual override
 */
export function useDirectionToggle(categoryId: string | null) {
  const { categories } = useCategoriesData();
  const [signState, setSignState] = useState<-1 | 1>(-1); // -1 = Outflow, 1 = Inflow
  const [manualOverride, setManualOverride] = useState(false);

  // Auto-set direction based on category type
  /* eslint-disable react-hooks/set-state-in-effect -- Derived from category selection */
  useEffect(() => {
    if (!categoryId || manualOverride) return;

    const category = categories.find((c) => c.id === categoryId);
    if (category) {
      // Income category → default to Received (+1)
      // Expense category → default to Paid (-1)
      setSignState(category.type === 'income' ? 1 : -1);
    }
  }, [categoryId, categories, manualOverride]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleDirection = (direction: -1 | 1) => {
    setSignState(direction);
    setManualOverride(true); // User explicitly chose, don't auto-change
  };

  const resetOverride = () => {
    setManualOverride(false);
  };

  return {
    signState,
    toggleDirection,
    resetOverride,
    isOutflow: signState === -1,
    isInflow: signState === 1,
  };
}

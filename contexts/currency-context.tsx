'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useMainCurrency } from '@/lib/hooks/use-main-currency';
import { CURRENCY } from '@/lib/constants';

/**
 * Currency context value shape.
 *
 * SIMPLIFIED: Removed unused formatCurrency and formatCurrencyShort functions.
 * Use @/lib/utils/currency-formatter or @/lib/hooks/use-formatted-balance instead.
 */
interface CurrencyContextValue {
  /** User's main currency code (e.g., 'USD', 'EUR') */
  mainCurrency: string;
  /** Whether currency data is still loading */
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * CurrencyProvider - Provides main currency from user settings
 *
 * REFACTORED: Now uses lib-level useMainCurrency hook instead of
 * directly importing from settings feature. This eliminates the
 * context → feature dependency that violated architectural boundaries.
 *
 * REMOVED (unused):
 * - formatCurrency() - use @/lib/utils/currency-formatter instead
 * - formatCurrencyShort() - use @/lib/utils/currency-formatter instead
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { mainCurrency, isLoading } = useMainCurrency();

  const value: CurrencyContextValue = {
    // Return default during loading to prevent undefined states
    mainCurrency: isLoading ? CURRENCY.DEFAULT : mainCurrency,
    isLoading,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook to access main currency
 *
 * @example
 * ```tsx
 * const { mainCurrency, isLoading } = useCurrency();
 * if (isLoading) return <Loading />;
 * return <span>Main currency: {mainCurrency}</span>;
 * ```
 *
 * @throws Error if used outside of CurrencyProvider
 */
export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

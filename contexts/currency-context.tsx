'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import { useCurrencies } from '@/features/currencies/hooks/use-currencies';
import { CURRENCY } from '@/lib/constants';

interface CurrencyContextValue {
  mainCurrency: string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatCurrencyShort: (amount: number, currency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

/**
 * CurrencyProvider - Provides optimized currency formatting with memoized formatters
 *
 * Benefits:
 * - Single Intl.NumberFormat instance per currency (cached)
 * - Automatic main currency detection
 * - Better performance by avoiding repeated formatter creation
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: currencies } = useCurrencies();

  // Get main currency from user's currencies
  const mainCurrency = useMemo(
    () => currencies?.find(c => c.is_main)?.code || CURRENCY.DEFAULT,
    [currencies]
  );

  // Create memoized formatters with caching
  const formatters = useMemo(() => {
    const cache = new Map<string, Intl.NumberFormat>();

    /**
     * Get or create a cached formatter for a specific currency and decimal precision
     */
    const getFormatter = (currency: string, decimals: number) => {
      const key = `${currency}-${decimals}`;
      if (!cache.has(key)) {
        cache.set(key, new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }));
      }
      return cache.get(key)!;
    };

    return {
      /**
       * Format currency with 2 decimal places
       */
      format: (amount: number, currency: string) =>
        getFormatter(currency, CURRENCY.FORMAT.DECIMAL_PLACES).format(amount),

      /**
       * Format currency with no decimal places (for large numbers/summaries)
       */
      formatShort: (amount: number, currency: string) =>
        getFormatter(currency, 0).format(amount),
    };
  }, []); // Empty dependency array - formatters never change

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<CurrencyContextValue>(() => ({
    mainCurrency,
    formatCurrency: (amount: number, currency?: string) =>
      formatters.format(amount, currency || mainCurrency),
    formatCurrencyShort: (amount: number, currency?: string) =>
      formatters.formatShort(amount, currency || mainCurrency),
  }), [mainCurrency, formatters]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

/**
 * Hook to access currency formatting functions
 *
 * @example
 * ```tsx
 * const { formatCurrency, mainCurrency } = useCurrency();
 * return <span>{formatCurrency(100.50)}</span>; // Uses main currency
 * return <span>{formatCurrency(100.50, 'EUR')}</span>; // Specific currency
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

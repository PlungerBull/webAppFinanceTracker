import { useMemo } from 'react';

/**
 * Hook to format a balance with proper currency formatting
 * Memoized to avoid recalculating on every render
 */
export function useFormattedBalance(amount: number, currency: string) {
  return useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }, [amount]);
}

/**
 * Hook to format a balance with no decimals (for large numbers)
 */
export function useFormattedBalanceShort(amount: number, currency: string) {
  return useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, [amount]);
}

/**
 * Standalone function if you need to format outside of a React component
 */
export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyShort(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}